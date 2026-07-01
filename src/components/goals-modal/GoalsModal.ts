/**
 * GoalsModal — Painel de metas com linha de alvo por granularidade.
 *
 * Modal autônomo que:
 * - Lê dados de meta de `window.MyIOUtils.goalsData[domain]` (cache populado pelo MAIN_VIEW)
 * - Busca consumo real via callback `fetchConsumption` (injeção de dependência)
 * - Renderiza Chart.js diretamente (sem depender de createConsumptionChartWidget)
 * - Suporta granularidade horária (24h de um dia selecionado) e diária (últimos N dias)
 */

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
}

// Estrutura do goals JSON cacheado
interface GoalsTree {
  annual?: { value: number };
  monthly?: Record<string, { value: number; method?: string }>;
  daily?: Record<string, { value: number; method?: string }>;
  hourly?: Record<string, { value: number; method?: string }>;
}

interface GoalsJsonData {
  success: boolean;
  data?: {
    domain?: string;
    unit?: string;
    year?: number;
    tree?: GoalsTree;
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
    barColor: 'rgba(108, 47, 191, 0.75)',
    goalColor: '#ef4444',
    goalColorAlpha: 'rgba(239,68,68,0.12)',
  },
  water: {
    label: 'Água',
    icon: '💧',
    unit: 'm³',
    primaryColor: '#0288d1',
    barColor: 'rgba(2, 136, 209, 0.75)',
    goalColor: '#f59e0b',
    goalColorAlpha: 'rgba(245,158,11,0.12)',
  },
  temperature: {
    label: 'Temperatura',
    icon: '🌡️',
    unit: '°C',
    primaryColor: '#e65100',
    barColor: 'rgba(230, 81, 0, 0.75)',
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
let _periodDays = 30;
// YoY: compara o consumo do mesmo período com o ano anterior (não disponível p/ temperatura).
let _compareYoY = false;
// Monotonic render token: every _loadAndRender bumps it; a run only applies its
// result/loader if it is still the latest. Prevents rapid tab/granularity switches
// from being dropped (the old _isRendering early-return swallowed them).
let _renderSeq = 0;

function _todayISO(): string {
  // Local date (not UTC) — toISOString() would shift the day in UTC-3 late evening.
  const d = new Date();
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

function _formatValue(value: number, domain: string): string {
  const cfg = DOMAIN_CFG[domain] || DOMAIN_CFG.energy;
  if (cfg.threshold && cfg.unitLarge && Math.abs(value) >= cfg.threshold) {
    return `${(value / cfg.threshold).toFixed(2)} ${cfg.unitLarge}`;
  }
  return `${value.toFixed(domain === 'temperature' ? 1 : 2)} ${cfg.unit}`;
}

function _getGoalsTree(domain: string): GoalsTree | null {
  const cached: GoalsJsonData | null = window.MyIOUtils?.goalsData?.[domain] ?? null;
  return cached?.data?.tree ?? null;
}

/** Converte label "DD/MM" → chave daily "MM-DD" */
function _labelToDailyKey(label: string): string {
  const [dd, mm] = label.split('/');
  return `${mm}-${dd}`;
}

/** Retorna lista de N últimos dias como { label, startTs, endTs } */
function _buildDayBoundaries(n: number): Array<{ label: string; startTs: number; endTs: number }> {
  const now = new Date();
  const result = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const e = new Date(d);
    e.setHours(23, 59, 59, 999);
    result.push({
      label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      startTs: d.getTime(),
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
  const boundaries = _buildDayBoundaries(_periodDays);
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
  return _buildDayBoundaries(_periodDays);
}

/**
 * YoY: para cada boundary da janela atual, busca o consumo do MESMO período um ano antes
 * (shift de -1 ano via setFullYear, robusto a meses/dias). Alinhado posição-a-posição.
 */
async function _fetchPrevYearTotals(
  domain: string,
  gran: '1h' | '1d' | '1M',
  boundaries: Array<{ startTs: number; endTs: number }>
): Promise<number[]> {
  const fetchFn = _options!.fetchConsumption;
  const totals = new Array<number>(boundaries.length).fill(0);

  const results = await Promise.all(
    boundaries.map(async (b, idx) => {
      const ps = new Date(b.startTs); ps.setFullYear(ps.getFullYear() - 1);
      const pe = new Date(b.endTs); pe.setFullYear(pe.getFullYear() - 1);
      try {
        const devices = await fetchFn(domain, ps.getTime(), pe.getTime(), gran);
        const t = (Array.isArray(devices) ? devices : []).reduce(
          (sum, d) => sum + (Number(d.total_value) || Number(d.value) || 0), 0
        );
        return { idx, value: t };
      } catch {
        return { idx, value: 0 };
      }
    })
  );

  results.forEach(({ idx, value }) => { totals[idx] = value; });
  return totals;
}

async function _fetchTemperatureDayData(): Promise<{ labels: string[]; totals: number[] }> {
  const boundaries = _buildDayBoundaries(_periodDays);
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

function _buildGoalLine(domain: string, labels: string[], gran: '1h' | '1d' | '1M'): (number | null)[] {
  const tree = _getGoalsTree(domain);
  if (!tree) return labels.map(() => null);

  if (gran === '1h') {
    return labels.map((lbl) => {
      const hh = lbl.replace('h', '').padStart(2, '0');
      return tree.hourly?.[hh]?.value ?? tree.hourly?.[String(parseInt(hh, 10))]?.value ?? null;
    });
  }

  if (gran === '1M') {
    return labels.map((lbl) => {
      const m = MONTH_LABELS_PT.indexOf(lbl);
      if (m < 0) return null;
      const key = String(m + 1).padStart(2, '0');
      return tree.monthly?.[key]?.value ?? null;
    });
  }

  // 1d: label = "DD/MM" → daily key = "MM-DD"
  return labels.map((lbl) => {
    const key = _labelToDailyKey(lbl);
    return tree.daily?.[key]?.value ?? null;
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

  // YoY: barra cinza do ano anterior — empurrada PRIMEIRO + mesmo `order` que o consumo,
  // então agrupa à ESQUERDA da barra do ano atual.
  if (hasPrev) {
    datasets.push({
      type: 'bar',
      label: 'Ano anterior',
      data: prevTotals,
      backgroundColor: 'rgba(148, 163, 184, 0.55)',
      borderColor: 'rgba(148, 163, 184, 0.55)',
      borderWidth: 0,
      borderRadius: 3,
      order: 1,
    });
  }

  datasets.push({
    type: 'bar',
    label: `Consumo (${cfg.unit})`,
    data: totals,
    backgroundColor: cfg.barColor,
    borderColor: cfg.barColor,
    borderWidth: 0,
    borderRadius: 3,
    order: 1,
  });

  if (hasGoals) {
    datasets.push({
      type: 'line',
      label: `Meta (${cfg.unit})`,
      data: goalLine,
      borderColor: cfg.goalColor,
      borderWidth: 1.5,
      pointRadius: 0,
      pointHoverRadius: 4,
      fill: 'origin',
      backgroundColor: cfg.goalColorAlpha,
      tension: 0,
      order: 2,
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

    // YoY: consumo do mesmo período no ano anterior (energy/water; não p/ temperatura).
    let prevTotals: number[] | null = null;
    if (_compareYoY && domain !== 'temperature') {
      const boundaries = _buildBoundaries(gran, dateISO);
      prevTotals = await _fetchPrevYearTotals(domain, gran, boundaries);
      if (seq !== _renderSeq) return; // superada enquanto aguardava o ano anterior
    }

    const goalLine = _buildGoalLine(domain, labels, gran);

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

    // Stats footer
    if (statsEl) {
      const total = totals.reduce((a, b) => a + b, 0);
      const avg = totals.length ? total / totals.length : 0;
      const peak = Math.max(...totals);
      const peakLabel = labels[totals.indexOf(peak)] ?? '';
      const goalTotal = goalLine.reduce<number>((a, b) => a + (b ?? 0), 0);
      const pct = goalTotal > 0 ? ((total / goalTotal) * 100).toFixed(1) : null;

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
        ${pct !== null ? `<div class="gm-stat"><span class="gm-stat-label">vs Meta</span><span class="gm-stat-value gm-stat-pct" style="color:${parseFloat(pct) <= 100 ? '#10b981' : '#ef4444'}">${pct}%</span></div>` : ''}
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
    .gm-header{display:flex;align-items:center;gap:10px;padding:10px 16px;background:#3e1a7d;color:#fff;flex-shrink:0;flex-wrap:wrap;row-gap:6px;}
    .gm-header h3{margin:0;font-size:14px;font-weight:600;display:flex;align-items:center;gap:6px;}
    .gm-header-spacer{flex:1;}
    .gm-gran-wrap{display:flex;gap:2px;align-items:center;background:rgba(0,0,0,.2);border-radius:8px;padding:3px;}
    .gm-gran-btn{border:none;background:transparent;color:rgba(255,255,255,.65);font-size:12px;font-weight:700;padding:4px 12px;border-radius:6px;cursor:pointer;transition:all .15s;}
    .gm-gran-btn:hover{background:rgba(255,255,255,.15);color:#fff;}
    .gm-gran-btn.active{background:#fff;color:#3e1a7d;box-shadow:0 1px 4px rgba(0,0,0,.2);}
    .gm-yoy-btn{display:inline-flex;align-items:center;gap:4px;border:1px solid rgba(255,255,255,.3);background:rgba(0,0,0,.18);color:rgba(255,255,255,.8);font-size:11px;font-weight:700;padding:5px 10px;border-radius:8px;cursor:pointer;transition:all .15s;}
    .gm-yoy-btn:hover{background:rgba(255,255,255,.15);color:#fff;}
    .gm-yoy-btn.active{background:#fff;color:#3e1a7d;border-color:#fff;box-shadow:0 1px 4px rgba(0,0,0,.2);}
    .gm-date-input{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.3);border-radius:6px;color:#fff;font-size:12px;padding:3px 8px;cursor:pointer;outline:none;}
    .gm-date-input::-webkit-calendar-picker-indicator{filter:invert(1);opacity:.8;cursor:pointer;}
    .gm-date-wrap,.gm-year-wrap{display:flex;align-items:center;gap:6px;font-size:11px;color:rgba(255,255,255,.75);}
    #gm-year-input{width:68px;text-align:center;-moz-appearance:textfield;}
    #gm-year-input::-webkit-outer-spin-button,#gm-year-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
    .gm-close{background:transparent;border:none;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:4px;border-radius:4px;flex-shrink:0;}
    .gm-close:hover{background:rgba(255,255,255,.15);}
    .gm-tabs{display:flex;gap:4px;padding:8px 14px 0;background:#3e1a7d;flex-shrink:0;}
    .gm-tab{flex:0 0 auto;display:flex;align-items:center;gap:5px;padding:7px 14px;border:none;background:rgba(255,255,255,.08);color:#cbb6e8;font-size:12px;font-weight:600;cursor:pointer;border-radius:8px 8px 0 0;transition:all .15s;}
    .gm-tab:hover{background:rgba(255,255,255,.16);color:#fff;}
    .gm-tab.active{background:#fff;color:#3e1a7d;}
    .gm-body{flex:1;min-height:0;display:flex;flex-direction:column;padding:12px 14px 0;}
    .gm-chart-wrap{position:relative;flex:1;min-height:0;}
    #gm-chart-area{width:100%;height:100%;}
    #gm-canvas{width:100%!important;height:100%!important;}
    .gm-loading{position:absolute;inset:0;background:rgba(255,255,255,.85);display:flex;align-items:center;justify-content:center;z-index:10;border-radius:8px;}
    .gm-spinner{width:28px;height:28px;border:3px solid #e5e7eb;border-top-color:#3e1a7d;border-radius:50%;animation:gm-spin 1s linear infinite;}
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

  const hasGoalsHint = !_getGoalsTree(_currentDomain);

  return `
    <div class="gm-header">
      <h3>🎯 Metas</h3>
      <div class="gm-header-spacer"></div>
      <div class="gm-gran-wrap">
        <button class="gm-gran-btn${_currentGran === '1M' ? ' active' : ''}" data-gran="1M">1M</button>
        <button class="gm-gran-btn${_currentGran === '1d' ? ' active' : ''}" data-gran="1d">1d</button>
        <button class="gm-gran-btn${_currentGran === '1h' ? ' active' : ''}" data-gran="1h">1h</button>
      </div>
      <button class="gm-yoy-btn${_compareYoY ? ' active' : ''}" id="gm-yoy-btn" title="Comparar com o ano anterior (mesmo período)" style="display:${_currentDomain === 'temperature' ? 'none' : 'inline-flex'}">↔ Ano ant.</button>
      <div class="gm-year-wrap" id="gm-year-wrap" style="display:${_currentGran === '1M' ? 'flex' : 'none'}">
        <span>Ano:</span>
        <input type="number" id="gm-year-input" class="gm-date-input" value="${_selectedYear}" min="${new Date().getFullYear() - 5}" max="${new Date().getFullYear()}" />
      </div>
      <div class="gm-date-wrap" id="gm-date-wrap" style="display:${_currentGran === '1h' ? 'flex' : 'none'}">
        <span>Dia:</span>
        <input type="date" id="gm-date-input" class="gm-date-input" value="${_selectedDate}" max="${_todayISO()}" />
      </div>
      <button class="gm-close" id="gm-close" aria-label="Fechar">&times;</button>
    </div>
    <div class="gm-tabs">${tabs}</div>
    ${hasGoalsHint ? '<div class="gm-no-goals-hint">Linha de meta não disponível para este domínio (nenhuma meta cadastrada no GCDR para este ano)</div>' : ''}
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
      // YoY não se aplica a temperatura (médias) — esconde o botão nesse domínio.
      const yoyBtn = topDoc.getElementById('gm-yoy-btn');
      if (yoyBtn) yoyBtn.style.display = domain === 'temperature' ? 'none' : 'inline-flex';
      _updateGoalsHint(topDoc);
      _loadAndRender(_currentDomain, _currentGran, _selectedDate);
    });
  });

  // YoY toggle (comparar com o ano anterior)
  topDoc.getElementById('gm-yoy-btn')?.addEventListener('click', () => {
    _compareYoY = !_compareYoY;
    const btn = topDoc.getElementById('gm-yoy-btn');
    if (btn) btn.classList.toggle('active', _compareYoY);
    _loadAndRender(_currentDomain, _currentGran, _selectedDate);
  });

  // Granularity toggle
  overlay.querySelectorAll('.gm-gran-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const gran = (btn as HTMLElement).dataset.gran as '1h' | '1d' | '1M';
      if (gran === _currentGran) return;
      _currentGran = gran;
      overlay.querySelectorAll('.gm-gran-btn').forEach((b) =>
        b.classList.toggle('active', b === btn)
      );
      const dateWrap = topDoc.getElementById('gm-date-wrap');
      if (dateWrap) dateWrap.style.display = gran === '1h' ? 'flex' : 'none';
      const yearWrap = topDoc.getElementById('gm-year-wrap');
      if (yearWrap) yearWrap.style.display = gran === '1M' ? 'flex' : 'none';
      _loadAndRender(_currentDomain, _currentGran, _selectedDate);
    });
  });

  // Date picker (1h mode)
  topDoc.getElementById('gm-date-input')?.addEventListener('change', (e) => {
    _selectedDate = (e.target as HTMLInputElement).value || _todayISO();
    _loadAndRender(_currentDomain, _currentGran, _selectedDate);
  });

  // Year picker (1M mode)
  topDoc.getElementById('gm-year-input')?.addEventListener('change', (e) => {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    if (!isNaN(val)) _selectedYear = val;
    _loadAndRender(_currentDomain, _currentGran, _selectedDate);
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
}

// ============================================================================
// API pública
// ============================================================================

export const GoalsModal = {
  open(options: GoalsModalOptions): void {
    _options = options;
    _currentDomain = options.initialDomain ?? 'energy';
    _periodDays = options.defaultPeriodDays ?? 30;
    _selectedDate = _todayISO();
    _selectedYear = new Date().getFullYear();
    _currentGran = '1d';
    _compareYoY = false;

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
    requestAnimationFrame(() => overlay.classList.add('show'));

    _wireEvents(overlay, topDoc);

    setTimeout(() => {
      _loadAndRender(_currentDomain, _currentGran, _selectedDate);
    }, 80);
  },

  close(): void {
    if (!_overlay) return;
    _overlay.classList.remove('show');
    _destroyChart();
    const overlayRef = _overlay;
    _overlay = null;
    _options = null;
    overlayRef.addEventListener('transitionend', () => overlayRef.remove(), { once: true });
  },
};
