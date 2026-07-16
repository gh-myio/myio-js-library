/**
 * GoalsModal — Painel de metas com linha de alvo por granularidade.
 *
 * Modal autônomo que:
 * - Lê dados de meta de `window.MyIOUtils.goalsData[domain]` (cache populado pelo MAIN_VIEW)
 * - Busca consumo real via callback `fetchConsumption` (injeção de dependência)
 * - Renderiza Chart.js diretamente (sem depender de createConsumptionChartWidget)
 * - Suporta granularidade horária (24h de um dia selecionado) e diária (range de datas do picker)
 */

import { createDateRangePicker } from '../createDateRangePicker';
import type { DateRangeControl } from '../createDateRangePicker';
import { InfoTooltip } from '../../utils/tooltips/InfoTooltip';
import { buildCoverageWarningTextPtBR, hasCoverageGaps } from '../../utils/goalsCoverage';
import type { GoalsCoverageGaps } from '../../utils/goalsCoverage';

declare const Chart: any;
declare const window: any;

// ============================================================================
// Tipos públicos
// ============================================================================

export interface GoalsModalFetchConsumptionFn {
  (
    domain: string,
    startTs: number,
    endTs: number,
    granularity: '1h' | '1d' | '1M',
    groupId?: string | null
  ): Promise<GoalsDeviceTotal[]>;
}

/** Um ponto da série de consumo (endpoint agregado /{domain}/). */
export interface GoalsConsumptionSeriesPoint {
  timestamp: string | number;
  value: number;
}

/**
 * Preferido: busca a série de consumo do range INTEIRO em UMA request (vs N por dia).
 * A granularidade dita a forma: '1d' → 1 ponto/dia; '1h' → 1 ponto/hora. Para a view de
 * mês, o modal chama com '1d' e agrupa por mês. Retorna [{ timestamp, value }].
 */
export interface GoalsModalFetchConsumptionSeriesFn {
  (
    domain: string,
    startTs: number,
    endTs: number,
    granularity: '1h' | '1d' | '1M',
    groupId?: string | null
  ): Promise<GoalsConsumptionSeriesPoint[]>;
}

export interface GoalsDeviceTotal {
  id?: string;
  ingestionId?: string;
  device_id?: string;
  name?: string;
  label?: string;
  deviceName?: string;
  total_value?: number;
  value?: number;
}

export interface GoalsTemperatureDevice {
  id: string;
  name: string;
  consumption: Array<{ timestamp: string; value: number | null }>;
}

export interface GoalsModalOptions {
  /** Domínio inicial ao abrir (default: 'energy') */
  initialDomain?: 'energy' | 'water' | 'temperature';
  /** Callback que faz as requisições de consumo real (fallback: 1 request por boundary). */
  fetchConsumption: GoalsModalFetchConsumptionFn;
  /**
   * Preferido: busca a série de consumo do range inteiro em UMA request. Quando fornecido,
   * o modal usa isto (1 request por view) em vez do fetchConsumption por-boundary.
   */
  fetchConsumptionSeries?: GoalsModalFetchConsumptionSeriesFn;
  /** Callback opcional para temperatura */
  fetchTemperature?: (startTs: number, endTs: number) => Promise<GoalsTemperatureDevice[]>;
  /** Número de dias para view 1d (default: 30) */
  defaultPeriodDays?: number;
  /**
   * Throttle das requisições de consumo (executadas em série p/ não sobrecarregar a API).
   * ms de espera entre cada request. Default 900. Use 0 para desabilitar o delay.
   */
  throttlePerReqMs?: number;
  /** Número de requests antes da pausa maior. Default 5. */
  throttleBatchSize?: number;
  /** Pausa extra (ms) a cada `throttleBatchSize` requests. Default 1500. */
  throttleBatchPauseMs?: number;
  /**
   * Paleta do dashboard (createMyIOTheme OU mapa plano de CSS vars) — igual ao
   * `theme` do AllReportModal. Quando presente, o modal aplica as CSS vars
   * `--myio-*` no root (overlay) e o chrome (header/tabs/botões/spinner) passa a
   * seguir o accent do host. Sem este param, o modal lê `window.MyIOUtils.theme`.
   */
  theme?: { cssVars(): Record<string, string> } | Record<string, string>;
}

// Estrutura do goals JSON cacheado
interface GoalsTree {
  // RFC-0052 (GCDR): adjustedValue = value × (1 + goalMarginPct/100) — a "Meta"
  // com a margem de gestão aplicada (igual a value quando margem 0/ausente)
  annual?: { value: number; adjustedValue?: number };
  monthly?: Record<string, { value: number; adjustedValue?: number; method?: string }>;
  daily?: Record<string, { value: number; adjustedValue?: number; method?: string }>;
  hourly?: Record<string, { value: number; adjustedValue?: number; method?: string }>;
}

/** Meta por medidor de entrada (Addendum A — anos com granularity DEVICE). */
interface GoalsDeviceEntry {
  deviceId?: string;
  code?: string;
  label?: string;
  allocation?: 'EXPLICIT' | 'RESIDUAL';
  annual?: number;
  annualAdjusted?: number;
  hoursCovered?: number;
  coverageGaps?: GoalsCoverageGaps;
}

interface GoalsJsonData {
  success: boolean;
  data?: {
    domain?: string;
    unit?: string;
    year?: number;
    tree?: GoalsTree;
    // GCDR Goals 2026-07 (Addendum A) — presentes só em leituras novas; anos
    // CUSTOMER legados seguem byte-idênticos (parsing tolerante, sem mudança
    // de comportamento quando ausentes).
    granularity?: 'CUSTOMER' | 'DEVICE';
    devices?: GoalsDeviceEntry[];
    hoursCovered?: number;
    coverageGaps?: GoalsCoverageGaps;
  };
}

// ============================================================================
// Configuração por domínio
// ============================================================================

const DOMAIN_CFG: Record<string, {
  label: string;
  icon: string;
  unit: string;
  unitLarge?: string;
  threshold?: number;
  primaryColor: string;
  barColor: string;
  /** Fill semitransparente da série de consumo no modo linha. */
  barColorAlpha: string;
  goalColor: string;
  goalColorAlpha: string;
}> = {
  energy: {
    label: 'Energia',
    icon: '⚡',
    unit: 'kWh',
    unitLarge: 'MWh',
    threshold: 1000,
    primaryColor: '#3e1a7d',
    barColor: '#6c5ce7',
    barColorAlpha: 'rgba(108,92,231,0.15)',
    goalColor: '#f97316',
    goalColorAlpha: 'rgba(249,115,22,0.12)',
  },
  water: {
    label: 'Água',
    icon: '💧',
    unit: 'm³',
    primaryColor: '#0288d1',
    barColor: '#0891b2',
    barColorAlpha: 'rgba(8,145,178,0.15)',
    goalColor: '#f59e0b',
    goalColorAlpha: 'rgba(245,158,11,0.12)',
  },
  temperature: {
    label: 'Temperatura',
    icon: '🌡️',
    unit: '°C',
    primaryColor: '#e65100',
    barColor: '#e65100',
    barColorAlpha: 'rgba(230,81,0,0.15)',
    goalColor: '#10b981',
    goalColorAlpha: 'rgba(16,185,129,0.12)',
  },
};

const DOMAIN_ORDER = ['energy', 'water', 'temperature'] as const;

// ============================================================================
// Estado do módulo
// ============================================================================

let _overlay: HTMLElement | null = null;
let _chartInstance: any = null;
let _options: GoalsModalOptions | null = null;
let _currentDomain: string = 'energy';
let _currentGran: '1h' | '1d' | '1M' = '1d';
let _selectedDate: string = _todayISO();
let _selectedYear: number = new Date().getFullYear();
// Janela da granularidade diária (datas ISO locais, inclusive). Antes era só um
// comprimento (_periodDays) ancorado em "hoje" — o start escolhido no picker era
// descartado e qualquer range passado virava "últimos N dias".
let _periodStart: string = _isoNDaysAgo(29);
let _periodEnd: string = _todayISO();
// YoY: o consumo do ano anterior (mesmo período) é SEMPRE buscado/plotado (exceto temperatura).
// Sem toggle — vira 3ª linha (view linha) / barra pareada (view barra) + linha de meta.
// Tipo do gráfico: barras (default) ou linhas.
let _chartType: 'bar' | 'line' = 'bar';
// Cache do último render p/ os toggles (tipo) re-renderizarem sem refazer o fetch.
let _lastRender:
  | { labels: string[]; totals: number[]; goalLine: (number | null)[]; prevTotals: number[] | null; domain: string }
  | null = null;
// Monotonic render token: every _loadAndRender bumps it; a run only applies its
// result/loader if it is still the latest. Prevents rapid tab/granularity switches
// from being dropped (the old _isRendering early-return swallowed them).
let _renderSeq = 0;
let _datePickerControl: DateRangeControl | null = null;

function _todayISO(): string {
  // Local date (not UTC) — toISOString() would shift the day in UTC-3 late evening.
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function _isoNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// ============================================================================
// Helpers
// ============================================================================

function _getTopDoc(): Document {
  try {
    return (window.top || window).document;
  } catch {
    return document;
  }
}

// Tema efetivo: param explícito OU o global do dashboard (MyIOUtils.theme) —
// o MENU pode não passar o param, mas a MAIN expõe o global (createMyIOTheme).
function _resolveThemeSource(): GoalsModalOptions['theme'] | undefined {
  if (_options?.theme) return _options.theme;
  if (typeof window === 'undefined') return undefined;
  return window.MyIOUtils?.theme;
}

// Aplica a paleta do dashboard (createMyIOTheme OU mapa plano de CSS vars) no
// root da modal: os estilos internos já leem var(--myio-brand-700). Idêntico ao
// applyTheme do AllReportModal.
function _applyTheme(root: HTMLElement): void {
  const theme = _resolveThemeSource();
  if (!theme) return;
  const vars: Record<string, string> | null =
    typeof (theme as { cssVars?: () => Record<string, string> }).cssVars === 'function'
      ? (theme as { cssVars(): Record<string, string> }).cssVars()
      : (theme as Record<string, string>);
  if (!vars) return;
  Object.entries(vars).forEach(([k, v]) => {
    if (k.startsWith('--') && typeof v === 'string') root.style.setProperty(k, v);
  });
}

function _formatValue(value: number, domain: string): string {
  const cfg = DOMAIN_CFG[domain] || DOMAIN_CFG.energy;
  if (cfg.threshold && cfg.unitLarge && Math.abs(value) >= cfg.threshold) {
    return `${(value / cfg.threshold).toFixed(2)} ${cfg.unitLarge}`;
  }
  return `${value.toFixed(domain === 'temperature' ? 1 : 2)} ${cfg.unit}`;
}

function _getGoalsData(domain: string): GoalsJsonData['data'] | null {
  const cached: GoalsJsonData | null = window.MyIOUtils?.goalsData?.[domain] ?? null;
  return cached?.data ?? null;
}

function _getGoalsTree(domain: string): GoalsTree | null {
  return _getGoalsData(domain)?.tree ?? null;
}

/** Converte label "DD/MM" → chave daily "MM-DD" */
function _labelToDailyKey(label: string): string {
  const [dd, mm] = label.split('/');
  return `${mm}-${dd}`;
}

/** Retorna um slot por dia do range [startISO..endISO] (inclusive) como { label, startTs, endTs } */
function _buildDayBoundaries(startISO: string, endISO: string): Array<{ label: string; startTs: number; endTs: number }> {
  const result = [];
  const d = new Date(`${startISO}T00:00:00`);
  const last = new Date(`${endISO}T00:00:00`);
  // Guarda contra ranges invertidos/absurdos (picker já limita a 366 dias).
  for (let i = 0; d <= last && i < 400; i++, d.setDate(d.getDate() + 1)) {
    const s = new Date(d);
    const e = new Date(d);
    e.setHours(23, 59, 59, 999);
    result.push({
      label: s.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      startTs: s.getTime(),
      endTs: e.getTime(),
    });
  }
  return result;
}

/** Retorna 24 slots de hora para o dia selecionado */
function _buildHourBoundaries(dateISO: string): Array<{ label: string; startTs: number; endTs: number }> {
  const result = [];
  for (let h = 0; h < 24; h++) {
    const start = new Date(`${dateISO}T00:00:00`);
    start.setHours(h, 0, 0, 0);
    const end = new Date(start);
    end.setHours(h, 59, 59, 999);
    result.push({
      label: `${String(h).padStart(2, '0')}h`,
      startTs: start.getTime(),
      endTs: end.getTime(),
    });
  }
  return result;
}

const MONTH_LABELS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Retorna os meses do ano selecionado (até o mês atual se for o ano corrente) */
function _buildMonthBoundaries(year: number): Array<{ label: string; startTs: number; endTs: number; monthKey: string }> {
  const now = new Date();
  const lastMonth = year === now.getFullYear() ? now.getMonth() : 11;
  const result = [];
  for (let m = 0; m <= lastMonth; m++) {
    const start = new Date(year, m, 1, 0, 0, 0, 0);
    const end = new Date(year, m + 1, 0, 23, 59, 59, 999);
    result.push({
      label: MONTH_LABELS_PT[m],
      startTs: start.getTime(),
      endTs: end.getTime(),
      monthKey: String(m + 1).padStart(2, '0'),
    });
  }
  return result;
}

// ============================================================================
// Fetch de dados de consumo
// ============================================================================

// Defaults do throttle das consultas /devices/totals (executadas em SÉRIE p/ não
// sobrecarregar a API). Sobrescrevíveis por GoalsModal.open({ throttle* }).
const _THROTTLE_PER_REQ_MS_DEFAULT = 900;
const _THROTTLE_BATCH_SIZE_DEFAULT = 5;
const _THROTTLE_BATCH_PAUSE_MS_DEFAULT = 1500;

function _sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function _fetchTotalsThrottled(
  domain: string,
  boundaries: Array<{ startTs: number; endTs: number }>,
  granularity: '1h' | '1d' | '1M'
): Promise<number[]> {
  const fetchFn = _options!.fetchConsumption;
  // Parâmetros do throttle vindos das opções do componente (com defaults).
  const perReqMs = _options!.throttlePerReqMs ?? _THROTTLE_PER_REQ_MS_DEFAULT;
  const batchSize = _options!.throttleBatchSize ?? _THROTTLE_BATCH_SIZE_DEFAULT;
  const batchPauseMs = _options!.throttleBatchPauseMs ?? _THROTTLE_BATCH_PAUSE_MS_DEFAULT;
  const mySeq = _renderSeq; // este fetch pertence ao render atual
  const totals = new Array<number>(boundaries.length).fill(0);
  for (let i = 0; i < boundaries.length; i++) {
    if (_renderSeq !== mySeq) break; // um render mais novo começou — para de disparar
    const b = boundaries[i];
    try {
      const devices = await fetchFn(domain, b.startTs, b.endTs, granularity);
      totals[i] = (Array.isArray(devices) ? devices : []).reduce(
        (sum, d) => sum + (Number(d.total_value) || Number(d.value) || 0),
        0
      );
    } catch {
      totals[i] = 0;
    }
    // delay entre requests (não após a última)
    if (i < boundaries.length - 1 && perReqMs > 0) {
      await _sleep(perReqMs);
      if (batchSize > 0 && (i + 1) % batchSize === 0) await _sleep(batchPauseMs);
    }
  }
  return totals;
}

type _Boundary = { label: string; startTs: number; endTs: number; monthKey?: string };

// Mapeia a série (endpoint agregado) para os boundaries da view. O alinhamento dos timestamps
// difere pela granularidade da RESPOSTA:
//  - '1d' (view dia)  → 1 ponto/dia rotulado por data UTC → casa por "MM-DD".
//  - '1M' (view mês)  → série DIÁRIA agregada por mês → casa por "MM".
//  - '1h' (view hora) → 1 ponto/hora alinhado ao dia local → casa por contenção em [startTs,endTs].
function _seriesToTotals(
  series: GoalsConsumptionSeriesPoint[],
  boundaries: _Boundary[],
  viewGran: '1h' | '1d' | '1M'
): number[] {
  if (viewGran === '1h') {
    // por contenção temporal (instantes absolutos → TZ-agnóstico)
    const totals = new Array<number>(boundaries.length).fill(0);
    for (const pt of series) {
      if (!pt) continue;
      const ts = typeof pt.timestamp === 'number' ? pt.timestamp : new Date(pt.timestamp).getTime();
      const idx = boundaries.findIndex((b) => ts >= b.startTs && ts <= b.endTs);
      if (idx >= 0) totals[idx] += Number(pt.value) || 0;
    }
    return totals;
  }
  // '1d' / '1M': chave de data extraída da string ISO (sem conversão de TZ).
  const byKey = new Map<string, number>();
  for (const pt of series) {
    if (!pt) continue;
    const iso = typeof pt.timestamp === 'number' ? new Date(pt.timestamp).toISOString() : String(pt.timestamp);
    const key = viewGran === '1M' ? iso.slice(5, 7) : iso.slice(5, 10);
    byKey.set(key, (byKey.get(key) || 0) + (Number(pt.value) || 0));
  }
  return boundaries.map(
    (b) => byKey.get(viewGran === '1M' ? b.monthKey ?? '' : _labelToDailyKey(b.label)) ?? 0
  );
}

// Busca tudo em UMA request via fetchConsumptionSeries. `fetchGran` é a granularidade enviada à
// API (a view de mês usa '1d' e agrupa). Retorna null quando não há série (→ fallback throttled).
async function _fetchSeriesTotals(
  domain: string,
  boundaries: _Boundary[],
  viewGran: '1h' | '1d' | '1M',
  fetchGran: '1h' | '1d' | '1M'
): Promise<number[] | null> {
  const seriesFn = _options!.fetchConsumptionSeries;
  if (!seriesFn || boundaries.length === 0) return null;
  const start = boundaries[0].startTs;
  const end = boundaries[boundaries.length - 1].endTs;
  try {
    const series = await seriesFn(domain, start, end, fetchGran);
    if (!Array.isArray(series)) return null;
    return _seriesToTotals(series, boundaries, viewGran);
  } catch {
    return null;
  }
}

async function _fetchDayData(domain: string): Promise<{ labels: string[]; totals: number[] }> {
  const boundaries = _buildDayBoundaries(_periodStart, _periodEnd);
  const labels = boundaries.map((b) => b.label);
  const totals =
    (await _fetchSeriesTotals(domain, boundaries, '1d', '1d')) ??
    (await _fetchTotalsThrottled(domain, boundaries, '1d'));
  return { labels, totals };
}

async function _fetchHourData(domain: string, dateISO: string): Promise<{ labels: string[]; totals: number[] }> {
  const boundaries = _buildHourBoundaries(dateISO);
  const labels = boundaries.map((b) => b.label);
  const totals =
    (await _fetchSeriesTotals(domain, boundaries, '1h', '1h')) ??
    (await _fetchTotalsThrottled(domain, boundaries, '1h'));
  return { labels, totals };
}

async function _fetchMonthData(domain: string, year: number): Promise<{ labels: string[]; totals: number[] }> {
  const boundaries = _buildMonthBoundaries(year);
  const labels = boundaries.map((b) => b.label);
  // Mês: série DIÁRIA ('1d') sobre o ano, agrupada por mês (conforme contrato da API).
  const totals =
    (await _fetchSeriesTotals(domain, boundaries, '1M', '1d')) ??
    (await _fetchTotalsThrottled(domain, boundaries, '1M'));
  return { labels, totals };
}

/** Boundaries da janela atual conforme a granularidade (mesma base usada nos fetchers acima). */
function _buildBoundaries(gran: '1h' | '1d' | '1M', dateISO: string): Array<{ label: string; startTs: number; endTs: number }> {
  if (gran === '1M') return _buildMonthBoundaries(_selectedYear);
  if (gran === '1h') return _buildHourBoundaries(dateISO);
  return _buildDayBoundaries(_periodStart, _periodEnd);
}

/**
 * YoY: consumo do MESMO período um ano antes (shift de -1 ano, robusto a meses/dias),
 * alinhado posição-a-posição aos boundaries atuais.
 * Preferido: UMA request via fetchConsumptionSeries (mesmo caminho do ano atual). Fallback:
 * N requests por-boundary via fetchConsumption.
 */
async function _fetchPrevYearTotals(
  domain: string,
  gran: '1h' | '1d' | '1M',
  boundaries: _Boundary[]
): Promise<number[]> {
  // Desloca cada boundary -1 ano, preservando label/monthKey (chaves de mapeamento da série).
  const prevBoundaries: _Boundary[] = boundaries.map((b) => {
    const ps = new Date(b.startTs); ps.setFullYear(ps.getFullYear() - 1);
    const pe = new Date(b.endTs); pe.setFullYear(pe.getFullYear() - 1);
    return { ...b, startTs: ps.getTime(), endTs: pe.getTime() };
  });

  // 1 request via série (a view de mês usa '1d' e agrupa por mês).
  const viaSeries = await _fetchSeriesTotals(domain, prevBoundaries, gran, gran === '1M' ? '1d' : gran);
  if (viaSeries) return viaSeries;

  // Fallback: N requests por-boundary via fetchConsumption (throttle não se aplica aqui —
  // são apenas os buckets da janela; mantém o comportamento anterior).
  const fetchFn = _options!.fetchConsumption;
  const totals = new Array<number>(prevBoundaries.length).fill(0);
  const results = await Promise.all(
    prevBoundaries.map(async (b, idx) => {
      try {
        const devices = await fetchFn(domain, b.startTs, b.endTs, gran);
        const t = (Array.isArray(devices) ? devices : []).reduce(
          (sum, d) => sum + (Number(d.total_value) || Number(d.value) || 0),
          0
        );
        return { idx, value: t };
      } catch {
        return { idx, value: 0 };
      }
    })
  );
  results.forEach(({ idx, value }) => {
    totals[idx] = value;
  });
  return totals;
}

async function _fetchTemperatureDayData(): Promise<{ labels: string[]; totals: number[] }> {
  const boundaries = _buildDayBoundaries(_periodStart, _periodEnd);
  const labels = boundaries.map((b) => b.label);
  const totals = new Array<number>(boundaries.length).fill(0);
  const fetchFn = _options!.fetchTemperature;
  if (!fetchFn) return { labels, totals };

  try {
    const startTs = boundaries[0].startTs;
    const endTs = boundaries[boundaries.length - 1].endTs;
    const devices = await fetchFn(startTs, endTs);
    const dayMs = 24 * 60 * 60 * 1000;
    const sums = new Array<number>(boundaries.length).fill(0);
    const counts = new Array<number>(boundaries.length).fill(0);
    devices.forEach((dev) => {
      (dev.consumption || []).forEach((r) => {
        const idx = Math.floor((new Date(r.timestamp).getTime() - startTs) / dayMs);
        if (idx >= 0 && idx < boundaries.length && r.value != null) {
          sums[idx] += Number(r.value);
          counts[idx]++;
        }
      });
    });
    sums.forEach((s, i) => { totals[i] = counts[i] > 0 ? Math.round((s / counts[i]) * 10) / 10 : 0; });
  } catch { /* silent */ }

  return { labels, totals };
}

// ============================================================================
// Linha de meta
// ============================================================================

/**
 * Valor de META de um nó da árvore: prefere o adjustedValue do GCDR (RFC-0052 —
 * Orçado × margem de gestão, por customer × domínio × ano) e cai para value
 * quando a API ainda não o entrega. O antigo delta client-side (goalsDelta das
 * settings do widget) foi removido — a margem é única e gerida no servidor.
 */
function _goalNodeValue(node?: { value: number; adjustedValue?: number }): number | null {
  if (!node) return null;
  const v = node.adjustedValue ?? node.value;
  return v == null ? null : v;
}

function _buildGoalLine(domain: string, labels: string[], gran: '1h' | '1d' | '1M', dateISO?: string): (number | null)[] {
  const tree = _getGoalsTree(domain);
  if (!tree) return labels.map(() => null);

  if (gran === '1h') {
    const ref = (dateISO || _selectedDate).split('-');
    const mm = ref[1] ?? '';
    const dd = ref[2] ?? '';

    if (tree.hourly && Object.keys(tree.hourly).length > 0) {
      // Keys use "MM-DDThh" format (e.g. "07-01T09")
      return labels.map((lbl) => {
        const hh = lbl.replace('h', '').padStart(2, '0');
        return _goalNodeValue(tree.hourly![`${mm}-${dd}T${hh}`]);
      });
    }

    return labels.map(() => null);
  }

  if (gran === '1M') {
    return labels.map((lbl) => {
      const m = MONTH_LABELS_PT.indexOf(lbl);
      if (m < 0) return null;
      const key = String(m + 1).padStart(2, '0');
      return _goalNodeValue(tree.monthly?.[key]);
    });
  }

  // 1d: label = "DD/MM" → daily key = "MM-DD"
  return labels.map((lbl) => {
    const key = _labelToDailyKey(lbl);
    return _goalNodeValue(tree.daily?.[key]);
  });
}

// ============================================================================
// Renderização do chart
// ============================================================================

function _destroyChart(): void {
  if (_chartInstance) {
    try { _chartInstance.destroy(); } catch { /* ignore */ }
    _chartInstance = null;
  }
}

function _renderChart(
  canvas: HTMLCanvasElement,
  labels: string[],
  totals: number[],
  goalLine: (number | null)[],
  domain: string,
  prevTotals: number[] | null
): void {
  _destroyChart();

  const cfg = DOMAIN_CFG[domain] || DOMAIN_CFG.energy;
  const hasGoals = goalLine.some((v) => v !== null);
  const hasPrev = Array.isArray(prevTotals) && prevTotals.some((v) => v > 0);

  const datasets: any[] = [];
  const isLine = _chartType === 'line';

  // YoY: ano anterior — desenhado ATRÁS (order 4). Barra cinza pareada (view barra) /
  // linha cinza tracejada (view linha).
  if (hasPrev) {
    datasets.push({
      type: _chartType,
      label: 'Ano anterior',
      data: prevTotals,
      borderColor: 'rgba(148, 163, 184, 0.9)',
      backgroundColor: isLine ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.55)',
      borderDash: isLine ? [6, 4] : undefined,
      borderWidth: isLine ? 2 : 0,
      borderRadius: 3,
      fill: false,
      tension: 0.4,
      pointRadius: isLine ? 2 : 0,
      order: 4,
    });
  }

  // Consumo (ano atual) — order 5 (na frente do ano anterior).
  datasets.push({
    type: _chartType,
    label: `Consumo (${cfg.unit})`,
    data: totals,
    borderColor: cfg.barColor,
    backgroundColor: isLine ? cfg.barColorAlpha : cfg.barColor,
    borderWidth: isLine ? 2 : 0,
    borderRadius: 3,
    fill: isLine,
    tension: 0.4,
    pointRadius: isLine ? 3 : 0,
    pointHoverRadius: 4,
    order: 5,
  });

  // Meta — SEMPRE linha (laranja), sobre as barras/linhas (order 0).
  // A margem (RFC-0052) já vem aplicada nos pontos via adjustedValue — invisível na legenda.
  if (hasGoals) {
    datasets.push({
      type: 'line',
      label: `Meta (${cfg.unit})`,
      data: goalLine,
      borderColor: cfg.goalColor,
      backgroundColor: 'transparent',
      borderWidth: 3,
      pointRadius: 0,
      pointHoverRadius: 4,
      fill: false,
      spanGaps: true,
      tension: 0.4,
      order: 0,
    });
  }

  // Calculate Y max considering current totals, previous-year totals and goal values
  const allValues = [
    ...totals,
    ...(hasPrev ? prevTotals!.filter((v) => v > 0) : []),
    ...(hasGoals ? goalLine.filter((v): v is number => v !== null) : []),
  ].filter((v) => v > 0);
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 0;
  const yMax = maxVal > 0 ? Math.ceil(maxVal * 1.12) : undefined;

  // Bug-A fix (showcase): one unit/divisor for the WHOLE axis (decided from yMax),
  // instead of switching unit per tick (which mixed kWh and MWh on the same axis).
  const useLarge = !!(cfg.unitLarge && cfg.threshold && yMax && yMax >= cfg.threshold);
  const axisDivisor = useLarge ? cfg.threshold! : 1;
  const axisUnit = useLarge ? cfg.unitLarge! : cfg.unit;

  _chartInstance = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      // Hover mostra TODAS as séries do bucket (Consumo + Meta + Ano ant.) num só tooltip.
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: hasGoals || hasPrev,
          position: 'bottom',
          labels: { color: '#374151', font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label(ctx: any) {
              const v = ctx.parsed.y;
              if (v == null) return '';
              return `${ctx.dataset.label}: ${_formatValue(v, domain)}`;
            },
            // Resumo do ponto: desvio percentual vs meta e variação vs ano anterior.
            afterBody(items: any[]): string[] {
              const idx = items?.[0]?.dataIndex;
              if (idx == null) return [];
              const lines: string[] = [];
              const cons = totals[idx];
              const goal = goalLine[idx];
              if (goal != null && goal > 0) {
                // Ex.: consumo 23,10 × meta 29,04 → "20,5% abaixo da Meta"
                const dev = ((cons - goal) / goal) * 100;
                if (Math.abs(dev) < 0.05) lines.push('Na Meta (0,0%)');
                else
                  lines.push(
                    `${Math.abs(dev).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% ${dev < 0 ? 'abaixo' : 'acima'} da Meta`
                  );
              }
              if (hasPrev && prevTotals) {
                const prev = prevTotals[idx];
                if (prev > 0) {
                  const delta = ((cons - prev) / prev) * 100;
                  lines.push(`vs ano ant.: ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`);
                }
              }
              return lines;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: yMax,
          grid: { color: 'rgba(0,0,0,0.05)' },
          title: {
            display: true,
            text: axisUnit,
            font: { size: 11 },
            color: '#6b7280',
          },
          ticks: {
            color: '#6b7280',
            font: { size: 10 },
            callback(val: number) {
              return (val / axisDivisor).toFixed(useLarge ? 1 : 0);
            },
          },
        },
        x: {
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: {
            color: '#6b7280',
            font: { size: 10 },
            maxRotation: 45,
            autoSkip: true,
            maxTicksLimit: _currentGran === '1h' ? 24 : _currentGran === '1M' ? 12 : 15,
          },
        },
      },
    },
  });
}

// ============================================================================
// Lógica de carregamento e atualização
// ============================================================================

async function _loadAndRender(domain: string, gran: '1h' | '1d' | '1M', dateISO: string): Promise<void> {
  // Latest-wins: bump the token; only the most recent run touches the DOM/loader.
  const seq = ++_renderSeq;

  const topDoc = _getTopDoc();
  const chartArea = topDoc.getElementById('gm-chart-area');
  const loading = topDoc.getElementById('gm-loading');
  const statsEl = topDoc.getElementById('gm-stats');

  if (loading) loading.style.display = 'flex';
  if (statsEl) statsEl.textContent = '';

  try {
    let labels: string[];
    let totals: number[];

    if (domain === 'temperature') {
      ({ labels, totals } = await _fetchTemperatureDayData());
    } else if (gran === '1M') {
      ({ labels, totals } = await _fetchMonthData(domain, _selectedYear));
    } else if (gran === '1h') {
      ({ labels, totals } = await _fetchHourData(domain, dateISO));
    } else {
      ({ labels, totals } = await _fetchDayData(domain));
    }

    // A newer render started while we awaited — discard this stale result.
    if (seq !== _renderSeq) return;

    // YoY SEMPRE: consumo do mesmo período no ano anterior (energy/water; não p/ temperatura).
    let prevTotals: number[] | null = null;
    if (domain !== 'temperature') {
      const boundaries = _buildBoundaries(gran, dateISO);
      prevTotals = await _fetchPrevYearTotals(domain, gran, boundaries);
      if (seq !== _renderSeq) return; // superada enquanto aguardava o ano anterior
    }

    const goalLine = _buildGoalLine(domain, labels, gran, dateISO);

    // Chart.js must be loaded by the host page; fail with a visible message instead of a blank modal.
    if (typeof Chart === 'undefined') {
      if (chartArea) {
        chartArea.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#9ca3af;font-size:13px;text-align:center;padding:20px">Chart.js não está carregado nesta página.<br>Inclua a biblioteca Chart.js para exibir o gráfico de metas.</div>';
      }
      return;
    }

    // Canvas
    if (chartArea) chartArea.innerHTML = '<canvas id="gm-canvas"></canvas>';
    const canvas = topDoc.getElementById('gm-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;

    _renderChart(canvas, labels, totals, goalLine, domain, prevTotals);
    // Cache p/ os toggles (barra/linha) re-renderizarem sem refazer o fetch.
    _lastRender = { labels, totals, goalLine, prevTotals, domain };

    // Stats footer
    if (statsEl) {
      const total = totals.reduce((a, b) => a + b, 0);
      const avg = totals.length ? total / totals.length : 0;
      const peak = Math.max(...totals);
      const peakLabel = labels[totals.indexOf(peak)] ?? '';
      const goalTotal = goalLine.reduce<number>((a, b) => a + (b ?? 0), 0);
      // Mesmo formato do tooltip: desvio percentual em relação à meta do período
      // (ex.: consumo 77,4% da meta → "22,6% abaixo da Meta")
      let vsMetaHtml = '';
      if (goalTotal > 0) {
        const dev = ((total - goalTotal) / goalTotal) * 100;
        const devTxt = Math.abs(dev).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        const [txt, color] =
          Math.abs(dev) < 0.05
            ? ['Na Meta (0,0%)', '#10b981']
            : dev < 0
              ? [`${devTxt}% abaixo`, '#10b981']
              : [`${devTxt}% acima`, '#ef4444'];
        vsMetaHtml = `<div class="gm-stat"><span class="gm-stat-label">vs Meta</span><span class="gm-stat-value gm-stat-pct" style="color:${color}">${txt}</span></div>`;
      }

      // YoY stat — só quando há dados do ano anterior
      let yoyHtml = '';
      if (prevTotals && prevTotals.some((v) => v > 0)) {
        const curYear = gran === '1M' ? _selectedYear : gran === '1h' ? new Date(dateISO).getFullYear() : new Date().getFullYear();
        const prevSum = prevTotals.reduce((a, b) => a + b, 0);
        const yoyPct = prevSum > 0 ? ((total - prevSum) / prevSum) * 100 : 0;
        const yoyColor = yoyPct >= 0 ? '#10b981' : '#ef4444';
        yoyHtml = `<div class="gm-stat"><span class="gm-stat-label">Consumo ${curYear} x ${curYear - 1}</span><span class="gm-stat-value gm-stat-pct" style="color:${yoyColor}">${yoyPct >= 0 ? '+' : ''}${yoyPct.toFixed(1)}%</span></div>`;
      }

      statsEl.innerHTML = `
        <div class="gm-stat"><span class="gm-stat-label">Total</span><span class="gm-stat-value">${_formatValue(total, domain)}</span></div>
        <div class="gm-stat"><span class="gm-stat-label">Média</span><span class="gm-stat-value">${_formatValue(avg, domain)}</span></div>
        <div class="gm-stat"><span class="gm-stat-label">Pico</span><span class="gm-stat-value">${_formatValue(peak, domain)}<span class="gm-stat-sub">${peakLabel}</span></span></div>
        ${vsMetaHtml}
        ${yoyHtml}
      `;
    }
  } catch (err) {
    console.error('[GoalsModal] Erro ao carregar dados:', err);
  } finally {
    // Only the latest run owns the loader — a superseded run must not hide it early.
    if (loading && seq === _renderSeq) loading.style.display = 'none';
  }
}

// Re-renderiza o gráfico a partir do cache (sem refetch) — usado pelo toggle Barra/Linha.
function _rerenderFromCache(): void {
  if (!_lastRender || typeof Chart === 'undefined') return;
  const topDoc = _getTopDoc();
  const chartArea = topDoc.getElementById('gm-chart-area');
  if (chartArea) chartArea.innerHTML = '<canvas id="gm-canvas"></canvas>';
  const canvas = topDoc.getElementById('gm-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const { labels, totals, goalLine, prevTotals, domain } = _lastRender;
  _renderChart(canvas, labels, totals, goalLine, domain, prevTotals);
}

// ============================================================================
// DOM — CSS injetado
// ============================================================================

const STYLE_ID = 'myio-goals-modal-v2-styles';

function _injectStyles(topDoc: Document): void {
  if (topDoc.getElementById(STYLE_ID)) return;
  const s = topDoc.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    .gm-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);opacity:0;transition:opacity .2s ease;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}
    .gm-overlay.show{opacity:1;}
    .gm-modal{position:relative;background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.25);width:min(1000px,95vw);height:min(660px,90vh);overflow:hidden;display:flex;flex-direction:column;transform:translateY(12px) scale(.98);transition:transform .2s ease;}
    .gm-overlay.show .gm-modal{transform:translateY(0) scale(1);}
    .gm-header{display:flex;align-items:center;gap:10px;padding:10px 16px;background:var(--myio-brand-700, #3e1a7d);color:#fff;flex-shrink:0;flex-wrap:wrap;row-gap:6px;}
    .gm-header h3{margin:0;font-size:14px;font-weight:600;display:flex;align-items:center;gap:6px;}
    .gm-header-spacer{flex:1;}
    .gm-gran-wrap{display:flex;gap:2px;align-items:center;background:rgba(0,0,0,.2);border-radius:8px;padding:3px;}
    .gm-gran-btn{border:none;background:transparent;color:rgba(255,255,255,.65);font-size:12px;font-weight:700;padding:4px 12px;border-radius:6px;cursor:pointer;transition:all .15s;}
    .gm-gran-btn:hover{background:rgba(255,255,255,.15);color:#fff;}
    .gm-gran-btn.active{background:#fff;color:var(--myio-brand-700, #3e1a7d);box-shadow:0 1px 4px rgba(0,0,0,.2);}
    .gm-date-input{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.3);border-radius:6px;color:#fff;font-size:12px;padding:3px 8px;cursor:pointer;outline:none;}
    .gm-date-picker-wrap{display:flex;align-items:center;}
    /* "DD/MM/YYYY até DD/MM/YYYY" precisa de ~170px em 12px Roboto — 155px cortava o final */
    #gm-date-range-input{min-width:195px;}
    .gm-close{background:transparent;border:none;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:4px;border-radius:4px;flex-shrink:0;}
    .gm-close:hover{background:rgba(255,255,255,.15);}
    .gm-tabs{display:flex;gap:4px;padding:8px 14px 0;background:var(--myio-brand-700, #3e1a7d);flex-shrink:0;}
    .gm-tab{flex:0 0 auto;display:flex;align-items:center;gap:5px;padding:7px 14px;border:none;background:rgba(255,255,255,.08);color:#cbb6e8;font-size:12px;font-weight:600;cursor:pointer;border-radius:8px 8px 0 0;transition:all .15s;}
    .gm-tab:hover{background:rgba(255,255,255,.16);color:#fff;}
    .gm-tab.active{background:#fff;color:var(--myio-brand-700, #3e1a7d);}
    .gm-body{flex:1;min-height:0;display:flex;flex-direction:column;padding:12px 14px 0;}
    .gm-chart-wrap{position:relative;flex:1;min-height:0;}
    #gm-chart-area{width:100%;height:100%;}
    #gm-canvas{width:100%!important;height:100%!important;}
    .gm-loading{position:absolute;inset:0;background:rgba(255,255,255,.85);display:flex;align-items:center;justify-content:center;z-index:10;border-radius:8px;}
    .gm-spinner{width:28px;height:28px;border:3px solid #e5e7eb;border-top-color:var(--myio-brand-700, #3e1a7d);border-radius:50%;animation:gm-spin 1s linear infinite;}
    @keyframes gm-spin{to{transform:rotate(360deg);}}
    .gm-footer{display:flex;align-items:flex-start;padding:10px 14px;border-top:1px solid #f3f4f6;flex-shrink:0;}
    #gm-stats{display:flex;justify-content:space-around;align-items:flex-start;width:100%;flex-wrap:wrap;gap:8px;}
    .gm-stat{display:flex;flex-direction:column;align-items:center;text-align:center;min-width:80px;}
    .gm-stat-label{font-size:10px;font-weight:500;color:#9ca3af;text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px;}
    .gm-stat-value{font-size:16px;font-weight:700;color:#111827;display:flex;flex-direction:column;align-items:center;gap:1px;}
    .gm-stat-sub{font-size:10px;font-weight:400;color:#6b7280;}
    .gm-stat-pct{font-size:18px!important;}
    .gm-no-goals-hint{font-size:10px;color:#9ca3af;padding:4px 14px 0;font-style:italic;}
  `;
  topDoc.head.appendChild(s);
}

// ============================================================================
// DOM — modal HTML
// ============================================================================

function _buildModalHTML(): string {
  const tabs = DOMAIN_ORDER.map((d) => {
    const cfg = DOMAIN_CFG[d];
    return `<button class="gm-tab${d === _currentDomain ? ' active' : ''}" data-domain="${d}">${cfg.icon} ${cfg.label}</button>`;
  }).join('');

  return `
    <div class="gm-header">
      <h3>🎯 Metas</h3>
      <div class="gm-header-spacer"></div>
      <div class="gm-gran-wrap" title="Tipo de gráfico">
        <button class="gm-gran-btn${_chartType === 'bar' ? ' active' : ''}" data-type="bar">Barra</button>
        <button class="gm-gran-btn${_chartType === 'line' ? ' active' : ''}" data-type="line">Linha</button>
      </div>
      <div class="gm-gran-wrap">
        <button class="gm-gran-btn${_currentGran === '1M' ? ' active' : ''}" data-gran="1M">1M</button>
        <button class="gm-gran-btn${_currentGran === '1d' ? ' active' : ''}" data-gran="1d">1d</button>
        <button class="gm-gran-btn${_currentGran === '1h' ? ' active' : ''}" data-gran="1h">1h</button>
      </div>
      <div class="gm-date-picker-wrap" id="gm-date-picker-wrap">
        <input type="text" id="gm-date-range-input" class="gm-date-input" readonly placeholder="Selecione o período…" />
      </div>
      <button class="gm-close" id="gm-close" aria-label="Fechar">&times;</button>
    </div>
    <div class="gm-tabs">${tabs}</div>
    <div class="gm-body">
      <div class="gm-chart-wrap">
        <div id="gm-chart-area"><canvas id="gm-canvas"></canvas></div>
        <div class="gm-loading" id="gm-loading" style="display:none"><div class="gm-spinner"></div></div>
      </div>
    </div>
    <div class="gm-footer"><div id="gm-stats"></div></div>
  `;
}

// ============================================================================
// Date picker helpers
// ============================================================================

function _defaultDatesForGran(gran: '1h' | '1d' | '1M'): { start: string; end: string } {
  const today = _todayISO();
  if (gran === '1h') return { start: today, end: today };
  if (gran === '1M') {
    const yr = _selectedYear;
    return { start: `${yr}-01-01`, end: `${yr}-12-31` };
  }
  return { start: _periodStart, end: _periodEnd };
}

function _applyDateRange(startISO: string, endISO: string): void {
  if (_currentGran === '1h') {
    _selectedDate = startISO.slice(0, 10);
  } else if (_currentGran === '1M') {
    _selectedYear = new Date(startISO).getFullYear();
  } else {
    _periodStart = startISO.slice(0, 10);
    _periodEnd = endISO.slice(0, 10);
  }
  _loadAndRender(_currentDomain, _currentGran, _selectedDate);
}

async function _initDatePicker(topDoc: Document): Promise<void> {
  const inputEl = topDoc.getElementById('gm-date-range-input') as HTMLInputElement | null;
  if (!inputEl) return;
  _datePickerControl?.destroy();
  _datePickerControl = null;
  const { start, end } = _defaultDatesForGran(_currentGran);
  _datePickerControl = await createDateRangePicker(inputEl, {
    presetStart: start,
    presetEnd: end,
    maxRangeDays: _currentGran === '1h' ? 1 : 366,
    locale: 'pt-BR',
    onApply: (result) => _applyDateRange(result.startISO, result.endISO),
  });
}

// ============================================================================
// Wiring de eventos
// ============================================================================

function _wireEvents(overlay: HTMLElement, topDoc: Document): void {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) GoalsModal.close();
  });

  topDoc.getElementById('gm-close')?.addEventListener('click', () => GoalsModal.close());

  // Domain tabs
  overlay.querySelectorAll('.gm-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const domain = (tab as HTMLElement).dataset.domain!;
      if (domain === _currentDomain) return;
      _currentDomain = domain;
      overlay.querySelectorAll('.gm-tab').forEach((t) =>
        t.classList.toggle('active', (t as HTMLElement).dataset.domain === domain)
      );
      _updateGoalsHint(topDoc);
      _loadAndRender(_currentDomain, _currentGran, _selectedDate);
    });
  });

  // Tipo de gráfico (Barra/Linha) — re-renderiza do cache, SEM refetch.
  overlay.querySelectorAll('.gm-gran-btn[data-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = (btn as HTMLElement).dataset.type as 'bar' | 'line';
      if (type === _chartType) return;
      _chartType = type;
      overlay
        .querySelectorAll('.gm-gran-btn[data-type]')
        .forEach((b) => b.classList.toggle('active', b === btn));
      _rerenderFromCache();
    });
  });

  // Granularity toggle
  overlay.querySelectorAll('.gm-gran-btn[data-gran]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const gran = (btn as HTMLElement).dataset.gran as '1h' | '1d' | '1M';
      if (gran === _currentGran) return;
      _currentGran = gran;
      overlay
        .querySelectorAll('.gm-gran-btn[data-gran]')
        .forEach((b) => b.classList.toggle('active', b === btn));
      // Reinicializa o picker com maxRangeDays e datas padrão da nova granularidade
      _initDatePicker(topDoc).catch(console.error);
      _loadAndRender(_currentDomain, _currentGran, _selectedDate);
    });
  });
}

function _updateGoalsHint(topDoc: Document): void {
  const existing = topDoc.getElementById('gm-no-goals-hint-el');
  const tabs = topDoc.querySelector('.gm-tabs');
  const hasGoals = !!_getGoalsTree(_currentDomain);
  if (hasGoals && existing) {
    existing.remove();
  } else if (!hasGoals && !existing && tabs) {
    const hint = topDoc.createElement('div');
    hint.id = 'gm-no-goals-hint-el';
    hint.className = 'gm-no-goals-hint';
    hint.textContent = 'Linha de meta não disponível para este domínio (nenhuma meta cadastrada no GCDR para este ano)';
    tabs.insertAdjacentElement('afterend', hint);
  }
  _updateCoverageHint(topDoc);
}

// Cobertura incompleta (GCDR Goals 2026-07): quando o GET do domínio traz
// coverageGaps, mostra um hint ⚠ discreto sob as tabs com InfoTooltip listando
// os buracos (meses/dias/horas sem meta). Ausente = cobertura completa.
let _coverageDetach: (() => void) | null = null;

function _updateCoverageHint(topDoc: Document): void {
  const existing = topDoc.getElementById('gm-coverage-hint-el');
  if (existing) {
    existing.remove();
  }
  if (_coverageDetach) {
    try { _coverageDetach(); } catch { /* já removido */ }
    _coverageDetach = null;
  }
  const data = _getGoalsData(_currentDomain);
  if (!data?.tree || !hasCoverageGaps(data.coverageGaps)) return;
  const tabs = topDoc.querySelector('.gm-tabs');
  if (!tabs) return;

  const hint = topDoc.createElement('div');
  hint.id = 'gm-coverage-hint-el';
  hint.className = 'gm-no-goals-hint';
  hint.style.cursor = 'help';
  const deviceCount = data.granularity === 'DEVICE' ? (data.devices?.length ?? 0) : 0;
  hint.textContent =
    `⚠ Meta incompleta para este domínio/ano` +
    (deviceCount > 0 ? ` · Por medidor (${deviceCount})` : '') +
    ` — passe o mouse para detalhes`;
  tabs.insertAdjacentElement('afterend', hint);

  const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  try {
    _coverageDetach = InfoTooltip.attach(hint, () => {
      const d = _getGoalsData(_currentDomain);
      const parts: string[] = [];
      if (hasCoverageGaps(d?.coverageGaps)) {
        parts.push(`<p style="margin:0 0 8px;">${esc(buildCoverageWarningTextPtBR(d?.coverageGaps, 'GERAL'))}</p>`);
      }
      (d?.devices || []).forEach((dev) => {
        if (!hasCoverageGaps(dev?.coverageGaps)) return;
        const label = dev.label || dev.code || 'medidor';
        parts.push(
          `<p style="margin:0 0 8px;">${esc(buildCoverageWarningTextPtBR(dev.coverageGaps, `do medidor ${label}`))}</p>`
        );
      });
      return {
        icon: '⚠️',
        title: 'Meta incompleta',
        content: `<div style="font-size:12px;line-height:1.55;color:#334155;">${parts.join('')}</div>`,
      };
    });
  } catch {
    /* tooltip é enfeite — nunca pode quebrar o modal */
  }
}

// ============================================================================
// API pública
// ============================================================================

export const GoalsModal = {
  open(options: GoalsModalOptions): void {
    _options = options;
    _currentDomain = options.initialDomain ?? 'energy';
    _periodEnd = _todayISO();
    _periodStart = _isoNDaysAgo((options.defaultPeriodDays ?? 30) - 1);
    _selectedDate = _todayISO();
    _selectedYear = new Date().getFullYear();
    _currentGran = '1d';
    _chartType = 'bar';
    _lastRender = null;

    const topDoc = _getTopDoc();
    _injectStyles(topDoc);

    // Fechar instância anterior se existir
    const existing = topDoc.getElementById('myio-goals-modal-v2');
    if (existing) {
      _destroyChart();
      existing.remove();
    }

    const overlay = topDoc.createElement('div');
    overlay.id = 'myio-goals-modal-v2';
    overlay.className = 'gm-overlay';

    const modal = topDoc.createElement('div');
    modal.className = 'gm-modal';
    modal.innerHTML = _buildModalHTML();
    overlay.appendChild(modal);
    topDoc.body.appendChild(overlay);

    _overlay = overlay;
    // Paleta do dashboard (param OU window.MyIOUtils.theme): CSS vars --myio-* no
    // root do overlay → header/tabs/botões/spinner herdam o accent do host.
    _applyTheme(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));

    _wireEvents(overlay, topDoc);
    // Hints (sem meta / meta incompleta) do domínio inicial — antes eram inline
    // no HTML do modal; agora o mesmo caminho da troca de aba cuida da abertura.
    _updateGoalsHint(topDoc);
    _initDatePicker(topDoc).catch(console.error);

    setTimeout(() => {
      _loadAndRender(_currentDomain, _currentGran, _selectedDate);
    }, 80);
  },

  close(): void {
    if (!_overlay) return;
    _overlay.classList.remove('show');
    _destroyChart();
    _datePickerControl?.destroy();
    _datePickerControl = null;
    if (_coverageDetach) {
      try { _coverageDetach(); } catch { /* já removido */ }
      _coverageDetach = null;
    }
    const overlayRef = _overlay;
    _overlay = null;
    _options = null;
    overlayRef.addEventListener('transitionend', () => overlayRef.remove(), { once: true });
  },
};
