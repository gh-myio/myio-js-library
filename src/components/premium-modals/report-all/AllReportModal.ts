// report-all/AllReportModal.ts
import { createModal } from '../internal/ModalPremiumShell';
import { toISOWithOffset, rangeDaysInclusive } from '../internal/engines/DateEngine';
import { toCsv } from '../internal/engines/CsvExporter';
import { fmtPt } from '../internal/engines/NumberFmt';
import { AuthClient } from '../internal/engines/AuthClient';
import { attach as attachDateRangePicker, DateRangeControl } from '../internal/DateRangePickerJQ';
import {
  attachFilterOrderingModal,
  FilterModalHandle,
  SortMode,
} from '../internal/filter-ordering/FilterOrderingModal';
import { OpenAllReportParams, ModalHandle, StoreItem } from '../types';
import { InfoTooltip } from '../../../utils/tooltips/InfoTooltip';
import { exportGridPdf, exportGridXls } from '../../telemetry-grid-shopping/export';
import type { TelemetryDevice } from '../../telemetry-grid-shopping/types';
import { createParticipationChart } from '../../graphs';
import type { ParticipationChartInstance } from '../../graphs';
import { createGranularitySelector } from '../../granularity-selector';
import type { GranularitySelectorInstance } from '../../granularity-selector';
import { createModalFooter } from '../footer-modal';
import type { ModalFooterInstance } from '../footer-modal';
// RFC-0228 A6 — R$ money column (additive + gated). `createReportMoneyColumn(undefined)`
// yields a disabled column whose HTML methods all return '' → byte-identical when off.
import {
  createReportMoneyColumn,
  type ReportMoneyColumn,
} from '../../financial-goals/reportMoneyColumn';
// RFC-0228 A7 — per-consumer realized-vs-goal R$ variance chip (additive + gated).
// `createMoneyVarianceColumn(undefined)` (or a config without `perDeviceGoal`) yields
// a disabled column whose HTML methods all return '' → byte-identical when off.
import {
  createMoneyVarianceColumn,
  type MoneyVarianceColumn,
} from '../../financial-goals/moneyVariance';
import { injectCoverageStyles } from '../../financial-goals/coverageStyles';
import { DEFAULT_CLAMP_RANGE } from '../../temperature/utils';

type SeriesPoint = { timestamp: number; value: number };

// Dia civil em America/Sao_Paulo (UTC-3 fixo) — agrega a série horária em diária.
const SP_OFFSET_MS = 3 * 60 * 60 * 1000;
const spDayStart = (ts: number): number => {
  const d = new Date(ts - SP_OFFSET_MS);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + SP_OFFSET_MS;
};

// Domain configuration
type Domain = 'energy' | 'water' | 'temperature';

interface DomainConfig {
  endpoint: string; // API endpoint path
  unit: string; // Display unit (kWh, m³)
  label: string; // Column label
  totalLabel: string; // Total section label
}

const DOMAIN_CONFIG: Record<Domain, DomainConfig> = {
  energy: {
    endpoint: 'energy',
    unit: 'kWh',
    label: 'Consumo (kWh)',
    totalLabel: 'Total kWh',
  },
  water: {
    endpoint: 'water',
    unit: 'm³',
    label: 'Consumo (m³)',
    totalLabel: 'Total m³',
  },
  temperature: {
    endpoint: 'temperature',
    unit: '°C',
    label: 'Temperatura (°C)',
    totalLabel: 'Média °C',
  },
};

interface StoreReading {
  identifier: string; // e.g., "SCMAL1230B" - unique store identifier
  name: string; // e.g., "McDonalds" - human-readable name
  consumption: number; // e.g., 152.43 - consumption in kWh or m³
  groupLabel?: string; // RFC-0182: present when "todos" mode — triggers section headers
  id?: string; // Data API item id (ingestionId) — needed for per-device series fetch (1h export)
  // Temperatura: `consumption` = MÉDIA do período (offset aplicado, leituras inválidas fora)
  noData?: boolean; // nenhuma leitura válida no período → exibe "Sem leitura", fora dos KPIs
  min?: number; // menor leitura válida (°C)
  max?: number; // maior leitura válida (°C)
  minTs?: number; // instante (ms) da menor leitura — tooltip da célula Mín
  maxTs?: number; // instante (ms) da maior leitura — tooltip da célula Máx
  readings?: number; // nº de leituras válidas (horárias)
  discarded?: number; // nº de leituras descartadas por estarem fora da faixa válida
}

// Estatística por sensor calculada da série horária (offset aplicado, inválidas descartadas)
interface TemperatureStats {
  avg: number | null;
  min: number | null;
  max: number | null;
  minTs: number | null;
  maxTs: number | null;
  readings: number;
  discarded: number;
  series: SeriesPoint[];
}

export class AllReportModal {
  private modal: any;
  private authClient: AuthClient;
  private data: StoreReading[] = [];
  private isLoading = false;
  private eventHandlers: { [key: string]: (() => void)[] } = {};
  private dateRangePicker: DateRangeControl | null = null;
  private currentPage = 1;
  private itemsPerPage = 10;
  private sortField: keyof StoreReading = 'consumption';
  private sortDirection: 'asc' | 'desc' = 'desc';
  private searchFilter = '';

  // Filter & Ordering Modal
  private filterModal: FilterModalHandle | null = null;
  private selectedStoreIds: Set<string> = new Set();
  private currentSortMode: SortMode = 'CONSUMPTION_DESC';

  // Debug logging flag - controlled by params.debug
  private debugEnabled: boolean;

  // Domain configuration
  private domainConfig: DomainConfig;

  // Granularity: '1d' (daily) | '1h' (hourly)
  private granularity: '1d' | '1h' = '1d';

  // Temperatura: estatísticas por sensor (key = ingestionId) da última carga
  private temperatureStats = new Map<string, TemperatureStats>();
  // Linhas expandidas (série do device na granularidade escolhida) — key = row.id
  private expandedIds = new Set<string>();
  // Série por device p/ energia/água (expansão) — key = `${granularity}|${id}`, por período
  private deviceSeriesCache = new Map<string, SeriesPoint[]>();

  // Hourly series fetched device-by-device for the 1h CSV export (the /totals endpoint
  // has no hourly granularity). Keyed by StoreReading.id; cache key = period, so a new
  // load or granularity switch invalidates it.
  private hourlySeriesCache: {
    key: string;
    series: Map<string, Array<{ timestamp: number; value: number }>>;
  } | null = null;

  // When true, devices flagged via `exclude_groups_totals` for this group are dropped
  // from the report so its total reconciles with the dashboard KPIs. Toggleable in the UI.
  private considerExclusion = true;
  // Raw API response kept so the exclusion toggle can re-map without a new fetch.
  private lastApiResponse: any = null;
  // Search period of the last load — fed to the PDF/XLS export headers.
  private exportPeriod: { startISO?: string | null; endISO?: string | null } | null = null;
  // Cleanup for the InfoTooltip attached to the exclusion-flag info icon.
  private exclusionTooltipCleanup: (() => void) | null = null;
  // Participation chart (right column) — created lazily on the first data load;
  // fed with the same rows the table shows (exclusion toggle + search respected).
  private participationChart: ParticipationChartInstance | null = null;
  // Granularity selector (shared component — same pattern as EnergyModal).
  private granularitySelector: GranularitySelectorInstance | null = null;
  // Footer premium: Customer · relógio · versão | Powered by MYIO | PDF/CSV/XLSX.
  // Os botões de export vivem AQUI (removidos da toolbar).
  private modalFooter: ModalFooterInstance | null = null;

  // RFC-0228 A6 — R$ money column. Disabled (all fragments '') when params.money is
  // absent, so the table/summary stay byte-identical to the pre-A6 report.
  private moneyColumn: ReportMoneyColumn;

  // RFC-0228 A7 — per-consumer realized-vs-goal R$ variance column. Disabled (all
  // fragments '') when params.money.perDeviceGoal is absent → byte-identical.
  private varianceColumn: MoneyVarianceColumn;

  constructor(private params: OpenAllReportParams) {
    this.authClient = new AuthClient({
      clientId: params.api.clientId,
      clientSecret: params.api.clientSecret,
      base: params.api.dataApiBaseUrl,
    });

    // Set domain configuration
    const domain = params.domain || 'energy';
    this.domainConfig = DOMAIN_CONFIG[domain];

    // Granularidade inicial: param explícito > temperatura em 1h (todos/climatizável/não
    // climatizável) > 1d nos demais domínios.
    this.granularity = params.granularity ?? (domain === 'temperature' ? '1h' : '1d');

    // Set debug flag from params (1 = enabled, 0 = disabled)
    this.debugEnabled = params.debug === 1;

    // RFC-0228 A6 — gate: no `money` config → disabled column (all HTML '' → byte-identical).
    this.moneyColumn = createReportMoneyColumn(params.money ?? null);
    if (this.moneyColumn.enabled && typeof document !== 'undefined') {
      // A4 coverage indicator (incomplete/unavailable total) needs its stylesheet.
      injectCoverageStyles(document);
    }

    // RFC-0228 A7 — gate: no `money.perDeviceGoal` → disabled column (all HTML '').
    // Realized R$ reuses A6's per-device map; the goal comes from perDeviceGoal.
    this.varianceColumn = createMoneyVarianceColumn(
      params.money && params.money.perDeviceGoal
        ? {
            overlay: params.money.overlay,
            perDeviceRealized: params.money.perDevice,
            perDeviceGoal: params.money.perDeviceGoal,
            headerLabel: params.money.varianceHeaderLabel,
          }
        : null
    );

    this.debugLog('🚀 AllReportModal initialized', {
      customerId: params.customerId,
      itemsListLength: params.itemsList?.length || 0,
      itemsList: params.itemsList,
      debugEnabled: this.debugEnabled,
      debugParam: params.debug,
      apiConfig: {
        hasIngestionToken: !!params.api.ingestionToken,
        dataApiBaseUrl: params.api.dataApiBaseUrl,
      },
    });
  }

  // Debug logging helper
  private debugLog(message: string, data?: any): void {
    if (this.debugEnabled) {
      console.log(`[AllReportModal DEBUG] ${message}`, data || '');
    }
  }

  private get isTemperature(): boolean {
    return (this.params.domain || 'energy') === 'temperature';
  }

  // Faixa de leituras válidas (°C, já com offset) — fora dela a leitura é descartada
  private get temperatureValidRange(): { min: number; max: number } {
    const r = this.params.temperatureValidRange;
    return r && Number.isFinite(r.min) && Number.isFinite(r.max) ? r : DEFAULT_CLAMP_RANGE;
  }

  private get temperatureIdealRange(): { min: number; max: number } | null {
    const r = this.params.temperatureIdealRange;
    return r && Number.isFinite(Number(r.min)) && Number.isFinite(Number(r.max))
      ? { min: Number(r.min), max: Number(r.max) }
      : null;
  }

  // offSetTemperature do sensor (vem do itemsList do MENU); 0 quando ausente
  private temperatureOffsetFor(id: string): number {
    const item = this.params.itemsList?.find((i) => String(i.id) === String(id));
    const off = Number(item?.temperatureOffset ?? 0);
    return Number.isFinite(off) ? off : 0;
  }

  // Identificador genérico (ex.: todo sensor de temperatura tem identifier "Temperatura")
  // não identifica nada → a coluna só aparece se algum device tiver um código de verdade.
  private showIdentifierColumn(rows: StoreReading[] = this.data): boolean {
    if (!this.isTemperature) return true;
    return rows.some((r) => {
      const id = String(r.identifier || '').trim();
      return !!id && !/^temperatura$/i.test(id) && id !== r.name;
    });
  }

  private fmtTemp(v: number | null | undefined): string {
    return v === null || v === undefined || !Number.isFinite(v) ? '—' : fmtPt(v);
  }

  // Helper: normalize identifiers (upper, strip spaces and non-alphanum)
  private normalizeId(v: string | null | undefined): string {
    return (v || '')
      .toString()
      .normalize('NFKC')
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[0300-036f]/g, '');
  }

  // Helper: extract store identifier from API item
  // Priority: assetName -> parse from name (last token or token after space) -> null
  private resolveStoreIdentifierFromApi(item: any): string | null {
    if (item?.assetName) {
      return item.assetName;
    }
    // Examples of `name`: "3F SCMAL2AC205HIJ", "3F SCMAL0L102A"
    const name: string = item?.name || '';
    if (!name) return null;

    // Try last "word" that looks like an alphanumeric code
    const tokens = name.trim().split(/\s+/);
    const last = tokens[tokens.length - 1] || '';
    if (/[A-Za-z0-9]{3,}/.test(last)) {
      return last;
    }

    // Fallback: first token that looks like a code
    const maybe = tokens.find((t) => /[A-Za-z0-9]{3,}/.test(t));
    return maybe || null;
  }

  // Helper: pick a numeric consumption from an API item
  private pickConsumption(item: any): number {
    const fields = ['total_value', 'totalValue', 'consumption', 'value', 'total', 'energy', 'kwh'];
    for (const f of fields) {
      if (item?.[f] !== undefined && item?.[f] !== null) {
        const n = typeof item[f] === 'string' ? parseFloat(item[f].replace(',', '.')) : Number(item[f]);
        if (!Number.isNaN(n)) return n;
      }
    }
    return 0;
  }

  // withIcon: título da modal leva "<emoji> <Domínio> - "; exports (PDF/XLS)
  // usam a versão sem emoji (jsPDF não renderiza emoji de forma confiável).
  private resolveTitle(withIcon = false): string {
    const domain = this.params.domain || 'energy';
    const group = this.params.group || 'lojas';

    const DOMAIN_BADGE: Record<string, { icon: string; label: string }> = {
      energy: { icon: '⚡', label: 'Energia' },
      water: { icon: '💧', label: 'Água' },
      temperature: { icon: '🌡️', label: 'Temperatura' },
    };

    const GROUP_TITLES: Record<string, Record<string, string>> = {
      energy: {
        lojas: 'Todas as Lojas',
        entrada: 'Dispositivos de Entrada',
        area_comum: 'Equipamentos em Área Comum',
        todos: 'Todos os Dispositivos de Energia',
      },
      water: {
        lojas: 'Todas as Lojas',
        entrada: 'Dispositivos de Entrada',
        area_comum: 'Equipamentos em Área Comum',
        banheiros: 'Banheiros',
        todos: 'Todos os Dispositivos de Água',
      },
      temperature: {
        climatizavel: 'Ambientes Climatizáveis',
        nao_climatizavel: 'Ambientes Não Climatizáveis',
        todos: 'Todos os Ambientes',
      },
    };

    const badge = DOMAIN_BADGE[domain] || DOMAIN_BADGE.energy;
    const groupTitle = GROUP_TITLES[domain]?.[group] ?? group;
    const domainPart = withIcon ? `${badge.icon} ${badge.label}` : badge.label;
    return `Relatório Geral - ${domainPart} - ${groupTitle}`;
  }

  public show(): ModalHandle {
    this.debugLog('🎭 Modal show() called - creating modal UI');

    this.modal = createModal({
      title: `${this.resolveTitle(true)}${this.debugEnabled ? ' [DEBUG MODE]' : ''}`,
      width: '85vw',
      height: '90vh',
      theme: this.params.ui?.theme || 'light',
    });

    this.renderContent();
    this.mountFooter();
    this.modal.on('close', () => {
      this.debugLog('🚪 Modal closing - cleaning up resources');

      // Cleanup footer premium (relógio + version checker + botões)
      if (this.modalFooter) {
        this.modalFooter.destroy();
        this.modalFooter = null;
      }

      // Cleanup DateRangePicker
      if (this.dateRangePicker) {
        this.dateRangePicker.destroy();
        this.dateRangePicker = null;
      }

      // Cleanup Mín/Máx InfoTooltips (temperatura)
      this.minMaxTooltipCleanups.forEach((fn) => fn());
      this.minMaxTooltipCleanups = [];

      // Cleanup exclusion-flag InfoTooltip
      if (this.exclusionTooltipCleanup) {
        this.exclusionTooltipCleanup();
        this.exclusionTooltipCleanup = null;
      }

      // Cleanup FilterModal
      if (this.filterModal) {
        this.filterModal.destroy();
        this.filterModal = null;
      }

      // Cleanup participation chart (also removes tooltips/fullscreen overlay)
      if (this.participationChart) {
        this.participationChart.destroy();
        this.participationChart = null;
      }

      // Cleanup granularity selector (tooltip + listeners)
      if (this.granularitySelector) {
        this.granularitySelector.destroy();
        this.granularitySelector = null;
      }

      this.authClient.clearCache();
      this.emit('close');
    });

    this.debugLog('✅ Modal created and ready to use');

    return {
      close: () => this.modal.close(),
      on: (event, handler) => this.on(event, handler),
    };
  }

  private renderContent(): void {
    const content = document.createElement('div');
    content.innerHTML = `
      <div class="myio-modal-scope">
        <div style="margin-bottom: 16px;">
          <div style="display: flex; gap: 16px; align-items: end; margin-bottom: 16px; flex-wrap: wrap;">
            <div class="myio-form-group" style="margin-bottom: 0;">
              <label class="myio-label" for="date-range">Período</label>
              <input type="text" id="date-range" class="myio-input" readonly placeholder="Selecione o período" style="width: 300px;">
            </div>
            <div class="myio-form-group" style="margin-bottom: 0;">
              <label class="myio-label">Granularidade</label>
              <div id="granularity-toggle" style="display: flex; align-items: center;"></div>
            </div>
            <button id="load-btn" class="myio-btn myio-btn-primary">
              <span class="myio-spinner" id="load-spinner" style="display: none;"></span>
              Carregar
            </button>
            <!-- Exports CSV/PDF/XLS vivem no footer premium (createModalFooter) -->
            <button id="filter-btn" class="myio-btn myio-btn-secondary" style="background: var(--myio-brand-700); color: white;">
              🔍 Filtros & Ordenação
            </button>
            <div class="myio-form-group" style="margin-bottom: 0; display: flex; align-items: center; gap: 6px; align-self: flex-end; padding-bottom: 8px;">
              <label for="consider-exclusion" style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; color: var(--myio-text, #374151); white-space: nowrap;">
                <input type="checkbox" id="consider-exclusion" checked style="cursor: pointer; width: 15px; height: 15px; accent-color: var(--myio-brand-700, #5b2c9d);">
                Considerar exclusão de totais
              </label>
              <span id="exclusion-info" aria-label="Sobre a exclusão de totais" style="
                display: inline-flex; align-items: center; justify-content: center;
                width: 16px; height: 16px; border-radius: 50%;
                background: var(--myio-brand-700, #5b2c9d); color: #fff;
                font-size: 11px; font-weight: 700; font-style: italic;
                font-family: Georgia, 'Times New Roman', serif; cursor: help;
                user-select: none;
              ">i</span>
            </div>
            <div class="myio-form-group" style="margin-bottom: 0; margin-left: auto;">
              <label class="myio-label" for="search-input">Busca rápida</label>
              <input type="text" id="search-input" class="myio-input" placeholder="Digite para filtrar..." style="width: 200px;">
            </div>
          </div>
        </div>

        <div id="error-container" style="display: none; background: #ffebee; color: #c62828; padding: 12px; border-radius: 6px; margin-bottom: 16px;">
        </div>

        <style>
          /* Split layout: table (left ~70%) + participation chart (right ~30%).
             Below 1100px the chart stacks under the table at full width. */
          .rp-content-split { display: flex; gap: 16px; align-items: flex-start; }
          .rp-content-split__main { flex: 1 1 70%; min-width: 0; }
          .rp-content-split__chart { flex: 0 0 30%; min-width: 280px; }
          @media (max-width: 1100px) {
            .rp-content-split { flex-direction: column; }
            .rp-content-split__main,
            .rp-content-split__chart { flex: 1 1 auto; width: 100%; min-width: 0; }
          }
        </style>
        <div class="rp-content-split">
          <div class="rp-content-split__main">
            <div id="summary-container" style="display: none; margin-bottom: 16px;">
            </div>

            <div id="table-container">
              <div style="text-align: center; padding: 40px; color: var(--myio-text-muted);">
                Selecione um período e clique em "Carregar" para visualizar os dados de todas as lojas.
              </div>
            </div>

            <div id="pagination-container" style="display: none; margin-top: 16px; text-align: center;">
            </div>
          </div>

          <div class="rp-content-split__chart" id="participation-chart-container">
            <div id="participation-chart-placeholder" style="
              border: 1px dashed var(--myio-border, #e5e7eb); border-radius: 10px;
              padding: 32px 16px; text-align: center; font-size: 13px;
              color: var(--myio-text-muted, #6b7280);
            ">Carregue os dados para ver a participação</div>
          </div>
        </div>
      </div>
    `;

    this.modal.setContent(content);
    this.applyTheme();
    this.setupEventListeners();
  }

  // Footer premium (createModalFooter): Customer · relógio · versão da lib |
  // Powered by MYIO Platform | PDF/CSV/XLSX. Os botões de export vivem aqui —
  // recebem os MESMOS ids da antiga toolbar para que loadData/exportHourlyCSV
  // continuem controlando disabled/spinner via getElementById.
  private mountFooter(): void {
    const win =
      typeof window !== 'undefined'
        ? (window as {
            MyIOLibrary?: { version?: string };
            MyIOOrchestrator?: { customerName?: string };
            MyIOUtils?: { customerName?: string };
          })
        : undefined;
    const lib = win?.MyIOLibrary;
    this.modalFooter = createModalFooter({
      // Fallback: globals do dashboard (controllers antigos não passam o param)
      customerName:
        this.params.customerName ||
        win?.MyIOOrchestrator?.customerName ||
        win?.MyIOUtils?.customerName ||
        '',
      libVersion: { current: lib?.version },
      themeMode: this.params.ui?.theme === 'dark' ? 'dark' : 'light',
      exports: {
        pdf: { onClick: () => this.exportPDF(), disabled: true, tooltipText: 'Exporta o resumo em PDF' },
        csv: {
          onClick: () => void this.exportCSV(),
          disabled: true,
          tooltipText: 'Exporta em CSV — na granularidade 1h, uma linha por dispositivo × hora',
        },
        xls: { onClick: () => this.exportXLS(), disabled: true, tooltipText: 'Exporta o resumo em XLSX' },
      },
    });
    if (this.modalFooter.buttons.csv) this.modalFooter.buttons.csv.element.id = 'export-btn';
    if (this.modalFooter.buttons.pdf) this.modalFooter.buttons.pdf.element.id = 'export-pdf-btn';
    if (this.modalFooter.buttons.xls) this.modalFooter.buttons.xls.element.id = 'export-xls-btn';

    // Anexa direto no root .myio-modal (abaixo do body) — o footer é full-width.
    const root =
      ((this.modal?.element as HTMLElement | undefined)?.closest('.myio-modal') as HTMLElement | null) ||
      (this.modal?.element as HTMLElement | undefined);
    root?.appendChild(this.modalFooter.element);
  }

  // Tema efetivo: param explícito OU o global do dashboard (MyIOUtils.theme) —
  // controllers antigos não passam o param, mas a MAIN expõe o global.
  private resolveThemeSource(): OpenAllReportParams['theme'] {
    if (this.params.theme) return this.params.theme;
    if (typeof window === 'undefined') return undefined;
    return (window as { MyIOUtils?: { theme?: OpenAllReportParams['theme'] } }).MyIOUtils?.theme;
  }

  // Aplica a paleta do dashboard (createMyIOTheme OU mapa plano de CSS vars)
  // no root da modal: os estilos internos já leem var(--myio-*).
  private applyTheme(): void {
    const theme = this.resolveThemeSource();
    if (!theme) return;
    const vars: Record<string, string> | null =
      typeof (theme as { cssVars?: () => Record<string, string> }).cssVars === 'function'
        ? (theme as { cssVars(): Record<string, string> }).cssVars()
        : (theme as Record<string, string>);
    // modal.element é o BODY da modal — sobe para .myio-modal para o header
    // (background var(--myio-brand-700)) também herdar a paleta.
    const el = this.modal?.element as HTMLElement | undefined;
    const root = (el?.closest?.('.myio-modal') as HTMLElement | null) || el;
    if (!vars || !root) return;
    Object.entries(vars).forEach(([k, v]) => {
      if (k.startsWith('--') && typeof v === 'string') root.style.setProperty(k, v);
    });
  }

  private async setupEventListeners(): Promise<void> {
    const loadBtn = document.getElementById('load-btn') as HTMLButtonElement;
    const filterBtn = document.getElementById('filter-btn') as HTMLButtonElement;
    const dateRangeInput = document.getElementById('date-range') as HTMLInputElement;
    const searchInput = document.getElementById('search-input') as HTMLInputElement;

    loadBtn?.addEventListener('click', () => this.loadData());
    filterBtn?.addEventListener('click', () => this.openFilterModal());

    // Granularity selector — mesmo componente da EnergyModal (createGranularitySelector).
    // 1h só muda o CSV export (série horária por device); a tabela segue com totais.
    const granToggle = document.getElementById('granularity-toggle');
    if (granToggle) {
      this.granularitySelector?.destroy();
      this.granularitySelector = createGranularitySelector(granToggle, {
        settings: {
          value: this.granularity,
          // Padrão FIEL ao EnergyModal: pill "1h | 1d" (opções default do componente),
          // sem label interno (o form group acima já tem "Granularidade").
          label: '',
          tooltip: {
            enabled: true,
            title: 'Granularidade',
            text: this.isTemperature
              ? 'A tabela mostra a <b>média do período</b> de cada sensor. Clique em ▸ no sensor para ver a série <b>por hora</b> ou <b>por dia</b>; o CSV segue a mesma granularidade.'
              : 'A tabela mostra os <b>totais do período</b>. Clique em ▸ no dispositivo para ver a série <b>por hora</b> ou <b>por dia</b>; em Hora, o CSV traz uma linha por dispositivo × hora.',
          },
        },
        onChange: (value) => {
          this.granularity = value;
          this.hourlySeriesCache = null;
          // Linhas expandidas passam a mostrar a série na nova granularidade
          if (this.data.length && this.expandedIds.size) this.renderTable();
        },
      });
    }

    // Fix search input event listener
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchFilter = (e.target as HTMLInputElement).value.toLowerCase();
        this.currentPage = 1;
        this.renderTable();
        // RFC-0060: Removed pagination
      });

      // Also handle keyup for better responsiveness
      searchInput.addEventListener('keyup', (e) => {
        this.searchFilter = (e.target as HTMLInputElement).value.toLowerCase();
        this.currentPage = 1;
        this.renderTable();
        // RFC-0060: Removed pagination
      });
    }

    // Exclusion toggle — re-maps the cached API response without a new fetch.
    const exclusionCheckbox = document.getElementById('consider-exclusion') as HTMLInputElement | null;
    exclusionCheckbox?.addEventListener('change', () => {
      this.considerExclusion = exclusionCheckbox.checked;
      this.remapAndRender();
    });

    // Premium tooltip on the (i) icon, reusing the library InfoTooltip.
    const exclusionInfo = document.getElementById('exclusion-info');
    if (exclusionInfo) {
      this.exclusionTooltipCleanup?.();
      this.exclusionTooltipCleanup = InfoTooltip.attach(exclusionInfo, () => ({
        icon: 'ℹ️',
        title: 'Exclusão de totais',
        content: this.buildExclusionTooltipContent(),
      }));
    }

    // Initialize DateRangePicker with default current month range
    try {
      this.dateRangePicker = await attachDateRangePicker(dateRangeInput, {
        presetStart: this.getDefaultStartDate(),
        presetEnd: this.getDefaultEndDate(),
        // Ciclo de rateio (dia D → dia D do mês seguinte) tem até 32 dias corridos (ex.: 15/08→15/09)
        maxRangeDays: 32,
        parentEl: this.modal.element,
        onApply: ({ startISO, endISO }) => {
          this.hideError();
          this.debugLog('Date range selected:', { startISO, endISO });
        },
      });
    } catch (error) {
      // Sem fallback nativo: attach() lança quando as libs do CDN não carregam.
      this.debugLog('DateRangePicker initialization failed:', error);
    }

    // Abre já carregado com o período padrão do campo (o MENU hidrata o domínio antes de abrir)
    if (this.dateRangePicker) void this.loadData();
  }

  private async loadData(): Promise<void> {
    if (this.isLoading) return;

    this.debugLog('📊 Starting loadData process');

    const loadBtn = document.getElementById('load-btn') as HTMLButtonElement;
    const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
    const spinner = document.getElementById('load-spinner');

    if (!this.dateRangePicker) {
      this.showError('Seletor de data não inicializado');
      return;
    }

    this.isLoading = true;
    loadBtn.disabled = true;
    exportBtn.disabled = true;
    spinner!.style.display = 'inline-block';

    try {
      // Sem resolveQueryWindow aqui, de propósito: o picker é só-data e já devolve
      // 00:00:00 / 23:59:59 dos dias exibidos (fim no fim do dia N — buildMaxSpan).
      // O DeviceReportModal normaliza porque monta uma linha por dia (zero-fill) a partir
      // dessas datas; aqui só há totais por loja. Não "alinhar" os dois modais.
      const { startISO, endISO } = this.dateRangePicker.getDates();
      this.debugLog('📅 Date range selected', { startISO, endISO });
      this.exportPeriod = { startISO, endISO };
      this.hourlySeriesCache = null;
      this.deviceSeriesCache.clear();
      this.temperatureStats.clear();
      this.expandedIds.clear();

      if (!startISO || !endISO) {
        this.showError('Selecione um período válido');
        return;
      }

      const startDate = startISO.split('T')[0];
      const endDate = endISO.split('T')[0];

      // Real Customer Totals API call
      this.debugLog('🌐 Fetching customer totals from API...');
      const customerTotalsData = await this.fetchCustomerTotals(startISO, endISO);
      this.debugLog('✅ API response received', customerTotalsData);

      // Process and map the API response
      this.debugLog('🔄 Processing API response...');
      this.lastApiResponse = customerTotalsData; // kept for the exclusion toggle re-map
      this.data = this.mapCustomerTotalsResponse(customerTotalsData);
      this.debugLog('✅ Data mapping completed', {
        mappedDataLength: this.data.length,
        mappedData: this.data,
        totalConsumption: this.calculateTotalConsumption(),
      });

      // RFC-0061: Initialize all stores as selected by default (use identifier for uniqueness)
      this.selectedStoreIds = new Set(this.data.map((store) => this.generateStoreId(store.identifier)));
      this.debugLog('🎯 Store IDs initialized', {
        selectedStoreIdsSize: this.selectedStoreIds.size,
        selectedStoreIds: Array.from(this.selectedStoreIds),
      });

      this.currentPage = 1;

      this.debugLog('🎨 Rendering UI components...');
      this.renderSummary();
      this.renderTable();
      // RFC-0060: Removed pagination
      exportBtn.disabled = false;
      const pdfBtn = document.getElementById('export-pdf-btn') as HTMLButtonElement | null;
      const xlsBtn = document.getElementById('export-xls-btn') as HTMLButtonElement | null;
      if (pdfBtn) pdfBtn.disabled = false;
      if (xlsBtn) xlsBtn.disabled = false;

      this.debugLog('🎉 Load process completed successfully');

      this.emit('loaded', {
        date: { start: startDate, end: endDate },
        stores: this.data.length,
        totalConsumption: this.calculateTotalConsumption(),
      });
    } catch (error) {
      this.debugLog('❌ Error in loadData', error);
      this.showError('Erro ao carregar dados: ' + (error as Error).message);
      this.debugLog('Error loading data:', error);
      this.emit('error', { message: (error as Error).message, context: 'loadData' });
    } finally {
      this.isLoading = false;
      loadBtn.disabled = false;
      spinner!.style.display = 'none';
    }
  }

  private getFilteredData(): StoreReading[] {
    let filtered = this.data;

    // RFC-0061: Apply filter modal selections (if any stores are selected)
    if (this.selectedStoreIds.size > 0) {
      filtered = this.data.filter((store) => {
        const storeId = this.generateStoreId(store.identifier);
        return this.selectedStoreIds.has(storeId);
      });
    }

    // Apply quick search filter
    if (this.searchFilter) {
      filtered = filtered.filter((store) => {
        const name = (store.name || '').toString().toLowerCase();
        const identifier = (store.identifier || '').toString().toLowerCase();
        return name.includes(this.searchFilter) || identifier.includes(this.searchFilter);
      });
    }

    return filtered.sort((a, b) => {
      // Sensor sem leitura vai sempre para o fim (não é 0 °C)
      if (!!a.noData !== !!b.noData) return a.noData ? 1 : -1;
      const aVal = a[this.sortField];
      const bVal = b[this.sortField];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return this.sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else {
        return this.sortDirection === 'asc'
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number);
      }
    });
  }

  private getPaginatedData(): StoreReading[] {
    // RFC-0060: Removed pagination - return all filtered data
    return this.getFilteredData();
  }

  private renderSummary(): void {
    const container = document.getElementById('summary-container');
    if (!container) return;

    const kpiCard = (kpi: { value: string; label: string; sub?: string }) => `
        <div style="text-align: center;">
          <div style="font-size: 17px; font-weight: bold; color: var(--myio-primary);">${kpi.value}</div>
          <div style="font-size: 12px; color: var(--myio-text-muted);">${kpi.label}</div>
          ${kpi.sub ? `<div style="font-size: 10px; color: var(--myio-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${kpi.sub}">${kpi.sub}</div>` : ''}
        </div>`;

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; padding: 16px; background: var(--myio-bg); border-radius: 6px;">
        ${this.computeKpis().map(kpiCard).join('')}
      </div>
    `;

    container.style.display = 'block';
  }

  // KPIs do summary — compartilhados entre a UI (renderSummary) e o PDF export.
  // Máximo/Mínimo com nome do device; mínimo só entre devices COM consumo;
  // "Sem Consumo" oculto para temperature (média °C não tem semântica de zero).
  private computeKpis(): Array<{ value: string; label: string; sub?: string }> {
    if (this.isTemperature) return this.computeTemperatureKpis();
    const totalConsumption = this.calculateTotalConsumption();
    const storeCount = Math.max(1, this.data.length);
    const maxRow = this.data.reduce(
      (best: StoreReading | null, r) => (!best || r.consumption > best.consumption ? r : best),
      null
    );
    const minRow = this.data
      .filter((r) => r.consumption > 0)
      .reduce(
        (best: StoreReading | null, r) => (!best || r.consumption < best.consumption ? r : best),
        null
      );
    const zeroCount = this.data.filter((r) => r.consumption <= 0).length;
    const isTemperature = (this.params.domain || 'energy') === 'temperature';

    const kpis: Array<{ value: string; label: string; sub?: string }> = [
      { value: String(this.data.length), label: 'Dispositivos' },
      { value: fmtPt(totalConsumption), label: this.domainConfig.totalLabel },
      { value: fmtPt(totalConsumption / storeCount), label: 'Média por Dispositivo' },
      {
        value: maxRow ? fmtPt(maxRow.consumption) : '—',
        label: `Máximo (${this.domainConfig.unit})`,
        ...(maxRow?.name ? { sub: maxRow.name } : {}),
      },
      {
        value: minRow ? fmtPt(minRow.consumption) : '—',
        label: `Mínimo (${this.domainConfig.unit})`,
        ...(minRow?.name ? { sub: minRow.name } : {}),
      },
    ];
    if (!isTemperature) kpis.push({ value: String(zeroCount), label: 'Sem Consumo' });

    // RFC-0228 A6 — additive R$ KPI (only when the money gate is on). Honest total
    // when coverage is complete, else a coverage label — never R$ 0 / NaN.
    const moneyKpi = this.computeMoneyKpi();
    if (moneyKpi) kpis.push(moneyKpi);

    return kpis;
  }

  // Temperatura: média é MÉDIA (nunca soma); só sensores com leitura válida entram.
  private computeTemperatureKpis(): Array<{ value: string; label: string; sub?: string }> {
    const withData = this.data.filter((r) => !r.noData);
    const noData = this.data.length - withData.length;
    const avg = withData.length ? withData.reduce((s, r) => s + r.consumption, 0) / withData.length : null;
    const maxRow = withData.reduce((b: StoreReading | null, r) => (!b || r.consumption > b.consumption ? r : b), null);
    const minRow = withData.reduce((b: StoreReading | null, r) => (!b || r.consumption < b.consumption ? r : b), null);

    const kpis: Array<{ value: string; label: string; sub?: string }> = [
      {
        value: String(this.data.length),
        label: 'Sensores',
        ...(noData ? { sub: `${noData} sem leitura no período` } : {}),
      },
      { value: avg === null ? '—' : `${fmtPt(avg)} °C`, label: 'Média geral', sub: 'média das médias dos sensores' },
      {
        value: maxRow ? `${fmtPt(maxRow.consumption)} °C` : '—',
        label: 'Maior média',
        ...(maxRow?.name ? { sub: maxRow.name } : {}),
      },
      {
        value: minRow ? `${fmtPt(minRow.consumption)} °C` : '—',
        label: 'Menor média',
        ...(minRow?.name ? { sub: minRow.name } : {}),
      },
    ];

    const ideal = this.temperatureIdealRange;
    if (ideal) {
      const out = withData.filter((r) => r.consumption < ideal.min || r.consumption > ideal.max).length;
      kpis.push({
        value: String(out),
        label: 'Fora da faixa ideal',
        sub: `faixa ${fmtPt(ideal.min)}–${fmtPt(ideal.max)} °C`,
      });
    }

    const discarded = this.data.reduce((s, r) => s + (r.discarded || 0), 0);
    if (discarded > 0) {
      const v = this.temperatureValidRange;
      kpis.push({
        value: String(discarded),
        label: 'Leituras descartadas',
        sub: `fora de ${fmtPt(v.min)}–${fmtPt(v.max)} °C`,
      });
    }
    return kpis;
  }

  // RFC-0228 A6 — the "Custo projetado (R$)" summary KPI, or null when money is off.
  // Reuses the A6 column's honest-coverage resolution: a formatted R$ total only when
  // the overlay is confidently priced (DEC-8), otherwise a coverage state label.
  private computeMoneyKpi(): { value: string; label: string; sub?: string } | null {
    if (!this.moneyColumn.enabled) return null;
    const rowValues = this.data.map((r) => (r.id ? this.params.money?.perDevice?.[r.id] : null));
    const total = this.moneyColumn.resolveTotal(rowValues);
    if (!total) return null;
    const label = this.params.money?.headerLabel || 'Custo projetado (R$)';
    if (total.kind === 'amount') {
      return { value: total.formatted, label };
    }
    // Coverage state — honest label, never a number (§8-allowed wording).
    const value =
      total.overlay.state === 'unavailable' ? 'Indisponível' : 'Cobertura incompleta';
    return { value, label };
  }

  private renderTable(): void {
    const container = document.getElementById('table-container');
    if (!container) return;

    const paginatedData = this.getPaginatedData();
    const filteredData = this.getFilteredData();

    if (paginatedData.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--myio-text-muted);">
          ${this.searchFilter ? 'Nenhuma loja encontrada com o filtro aplicado.' : 'Nenhum dado encontrado.'}
        </div>
      `;
      this.updateParticipationChart();
      return;
    }

    // RFC-0182: grouped mode when items carry groupLabel
    const isGrouped = paginatedData.some((r) => r.groupLabel);

    // Base do percentual: total de TODOS os devices carregados (mesma base dos
    // KPIs do summary), não apenas os visíveis após busca/filtro.
    const grandTotal = this.calculateTotalConsumption();
    const showId = this.showIdentifierColumn();

    const tableRows = isGrouped
      ? this.renderGroupedRows(paginatedData, grandTotal)
      : paginatedData.map((row) => this.renderRowHTML(row, grandTotal, showId)).join('');

    container.innerHTML = `
      <div style="max-height: 500px; overflow-y: auto; border: 1px solid var(--myio-border); border-radius: 6px;">
        <style>
          .rp-group-header td {
            background: var(--myio-bg, #f3f4f6);
            font-weight: 700;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--myio-text-muted, #6b7280);
            padding: 8px 12px !important;
            border-top: 2px solid var(--myio-border, #e5e7eb);
          }
          .rp-group-total {
            font-size: 11px;
            font-weight: 600;
            color: var(--myio-primary, #1565c0);
            margin-left: 8px;
          }
          .rp-expand {
            border: none; background: transparent; cursor: pointer; padding: 0 6px 0 0;
            font-size: 12px; color: var(--myio-text-muted, #6b7280); line-height: 1;
            transition: transform .15s ease;
          }
          .rp-expand[aria-expanded="true"] { transform: rotate(90deg); color: var(--myio-brand-700, #3e1a7d); }
          .rp-series-row > td { background: var(--myio-bg, #f8fafc); padding: 8px 12px 12px 32px !important; }
          .rp-series { max-height: 260px; overflow-y: auto; font-size: 12px; }
          .rp-series table { width: 100%; border-collapse: collapse; }
          .rp-series th, .rp-series td { padding: 3px 8px; border-bottom: 1px solid var(--myio-border, #e5e7eb); }
          .rp-series th { text-align: left; font-weight: 600; color: var(--myio-text-muted, #6b7280); position: sticky; top: 0; background: var(--myio-bg, #f8fafc); }
          .rp-series td.num, .rp-series th.num { text-align: right; font-variant-numeric: tabular-nums; }
          .rp-muted { color: var(--myio-text-muted, #9ca3af); font-weight: 500; }
          .rp-temp-above { color: #dc2626; }
          .rp-minmax { cursor: help; border-bottom: 1px dotted currentColor; }
          .rp-offset { margin-left: 6px; font-size: 10px; font-weight: 400; color: var(--myio-text-muted, #9ca3af); opacity: .8; }
          .rp-temp-below { color: #2563eb; }
          @media (max-width: 768px) {
            .myio-table-mobile { display: block !important; }
            .myio-table-mobile thead,
            .myio-table-mobile tbody,
            .myio-table-mobile th,
            .myio-table-mobile td,
            .myio-table-mobile tr { display: block !important; }
            .myio-table-mobile thead tr { position: absolute !important; top: -9999px !important; left: -9999px !important; }
            .myio-table-mobile tbody tr { border: 1px solid var(--myio-border) !important; border-radius: 8px !important; margin-bottom: 16px !important; padding: 16px !important; background: white !important; }
            .myio-table-mobile tbody td { border: none !important; padding: 8px 0 !important; position: relative !important; }
            .myio-table-mobile tbody td:before { content: attr(data-label) ": " !important; font-weight: bold !important; display: inline-block !important; width: 120px !important; color: var(--myio-text-muted) !important; }
          }
        </style>
        <table class="myio-table myio-table-mobile" style="table-layout: fixed; width: 100%;">
          <thead style="position: sticky; top: 0; background: var(--myio-bg); z-index: 1;">
            <tr>${this.renderHeaderCellsHTML(showId)}</tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    `;

    this.setupTableSorting();
    this.setupRowExpansion(container);
    if (this.isTemperature) this.attachMinMaxTooltips(container);
    this.updateParticipationChart();
  }

  private sortableTh(field: keyof StoreReading, label: string, style: string): string {
    return `<th style="cursor: pointer; ${style}" data-sort="${field}">
                ${label}
                <span style="margin-left: 4px; opacity: ${this.getSortOpacity(field)};">${this.getSortIcon(field)}</span>
              </th>`;
  }

  // Colunas: energia/água = [Identificador] Nome | Consumo | (R$) | % ;
  // temperatura = [Identificador] Nome | Média | Mín | Máx (sem % — participação não se aplica).
  private renderHeaderCellsHTML(showId: boolean): string {
    const idTh = showId ? this.sortableTh('identifier', 'Identificador', 'width: 22%;') : '';
    if (this.isTemperature) {
      return (
        idTh +
        this.sortableTh('name', 'Sensor', `width: ${showId ? 34 : 52}%;`) +
        this.sortableTh('consumption', 'Média (°C)', 'text-align: right; width: 16%;') +
        this.sortableTh('min', 'Mín (°C)', 'text-align: right; width: 14%;') +
        this.sortableTh('max', 'Máx (°C)', 'text-align: right; width: 14%;')
      );
    }
    return (
      idTh +
      this.sortableTh('name', 'Nome', `width: ${showId ? 40 : 62}%;`) +
      this.sortableTh('consumption', this.domainConfig.label, 'text-align: right; width: 24%;') +
      `${this.moneyColumn.headerCellHTML()}${this.varianceColumn.headerCellHTML()}<th style="text-align: right; width: 14%;">%</th>`
    );
  }

  private columnCount(showId: boolean): number {
    const base = (showId ? 1 : 0) + 1;
    if (this.isTemperature) return base + 3;
    return base + 2 + (this.moneyColumn.enabled ? 1 : 0) + (this.varianceColumn.enabled ? 1 : 0);
  }

  private renderRowHTML(row: StoreReading, grandTotal: number, showId: boolean): string {
    const expandable = !!row.id;
    const expanded = expandable && this.expandedIds.has(row.id!);
    const expandBtn = expandable
      ? `<button type="button" class="rp-expand" data-expand-id="${row.id}" aria-expanded="${expanded}" title="Ver série por ${this.granularity === '1h' ? 'hora' : 'dia'}">▸</button>`
      : '';
    const idTd = showId
      ? `<td data-label="Identificador" style="font-family: monospace; font-weight: bold; text-transform: uppercase;">${row.identifier}</td>`
      : '';
    // Temperatura: offset do sensor, bem sutil — só quando ≠ 0 e de fato aplicado (há leitura)
    const off = this.isTemperature && row.id && !row.noData ? this.temperatureOffsetFor(row.id) : 0;
    const offsetTag = off
      ? ` <span class="rp-offset" title="Offset do sensor aplicado às leituras">offset ${off > 0 ? '+' : '−'}${fmtPt(Math.abs(off))} °C</span>`
      : '';
    const nameTd = `<td data-label="Nome">${expandBtn}<strong>${row.name}</strong>${offsetTag}</td>`;

    let valueTds: string;
    if (this.isTemperature) {
      const ideal = this.temperatureIdealRange;
      const cls =
        !row.noData && ideal
          ? row.consumption > ideal.max
            ? 'rp-temp-above'
            : row.consumption < ideal.min
              ? 'rp-temp-below'
              : ''
          : '';
      const avgTd = row.noData
        ? `<td data-label="Média (°C)" style="text-align: right;" class="rp-muted">Sem leitura</td>`
        : `<td data-label="Média (°C)" style="text-align: right; font-weight: bold;" class="${cls}">${fmtPt(row.consumption)}</td>`;
      valueTds =
        avgTd +
        this.minMaxCellHTML(row, 'min') +
        this.minMaxCellHTML(row, 'max');
    } else {
      const pct = grandTotal > 0 ? `${fmtPt((row.consumption / grandTotal) * 100)}%` : '—';
      valueTds =
        `<td data-label="${this.domainConfig.label}" style="text-align: right; font-weight: bold;">${fmtPt(row.consumption)}</td>` +
        // RFC-0228 A6/A7 — money fragments: '' when the gate is off (byte-identical)
        `${this.moneyColumn.bodyCellHTML(row.id)}${this.varianceColumn.bodyCellHTML(row.id)}` +
        `<td data-label="%" style="text-align: right; color: var(--myio-text-muted);">${pct}</td>`;
    }

    const seriesRow = expanded
      ? `<tr class="rp-series-row" data-series-for="${row.id}"><td colspan="${this.columnCount(showId)}"><div class="rp-series">Carregando série…</div></td></tr>`
      : '';
    return `<tr>${idTd}${nameTd}${valueTds}</tr>${seriesRow}`;
  }

  // Célula Mín/Máx (temperatura): valor + InfoTooltip com o dia/hora exato da leitura
  private minMaxCellHTML(row: StoreReading, kind: 'min' | 'max'): string {
    const label = kind === 'min' ? 'Mín (°C)' : 'Máx (°C)';
    const v = row.noData ? null : kind === 'min' ? row.min : row.max;
    const ts = kind === 'min' ? row.minTs : row.maxTs;
    if (v === null || v === undefined || !Number.isFinite(v) || !row.id || !ts) {
      return `<td data-label="${label}" style="text-align: right;">${this.fmtTemp(v)}</td>`;
    }
    return `<td data-label="${label}" style="text-align: right;"><span class="rp-minmax" data-mm="${kind}" data-row-id="${row.id}">${fmtPt(v)}</span></td>`;
  }

  private formatSpDateTime(ts: number): { date: string; time: string } {
    const d = new Date(ts);
    return {
      date: d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
    };
  }

  private buildMinMaxTooltip(row: StoreReading, kind: 'min' | 'max') {
    const v = (kind === 'min' ? row.min : row.max) as number;
    const ts = (kind === 'min' ? row.minTs : row.maxTs) as number;
    const { date, time } = this.formatSpDateTime(ts);
    const diff = v - row.consumption;
    const p = 'margin:0 0 6px;font-size:11px;line-height:1.5;color:#475569;';
    const isolated = Math.abs(diff) >= 8; // muito longe da média do sensor → provável leitura isolada
    return {
      icon: kind === 'min' ? '🔽' : '🔼',
      title: `${kind === 'min' ? 'Menor' : 'Maior'} leitura — ${row.name}`,
      content: `
        <div class="myio-info-tooltip__section" style="max-width:260px;">
          <p style="${p}"><strong style="font-size:14px;color:#0f172a;">${fmtPt(v)} °C</strong></p>
          <p style="${p}">📅 <strong>${date}</strong> às <strong>${time}</strong> (leitura individual)</p>
          <p style="${p}">Na série por hora (▸) ela entra na média das <strong>${time.slice(0, 2)}:00</strong>.</p>
          <p style="margin:0;font-size:11px;line-height:1.5;color:#475569;">
            Média do sensor no período: ${fmtPt(row.consumption)} °C (${diff >= 0 ? '+' : ''}${fmtPt(diff)} °C)
          </p>
        </div>
        ${
          isolated
            ? `<div class="myio-info-tooltip__notice"><span class="myio-info-tooltip__notice-icon">⚠️</span>
               <span>Bem distante da média — possível leitura isolada do sensor. Confira na série (▸).</span></div>`
            : ''
        }`,
    };
  }

  private minMaxTooltipCleanups: Array<() => void> = [];

  private attachMinMaxTooltips(container: HTMLElement): void {
    this.minMaxTooltipCleanups.forEach((fn) => fn());
    this.minMaxTooltipCleanups = [];
    container.querySelectorAll<HTMLElement>('.rp-minmax').forEach((el) => {
      const row = this.data.find((r) => r.id === el.dataset.rowId);
      const kind = el.dataset.mm === 'max' ? 'max' : 'min';
      if (!row) return;
      this.minMaxTooltipCleanups.push(InfoTooltip.attach(el, () => this.buildMinMaxTooltip(row, kind)));
    });
  }

  // ▸ no nome do device: abre/fecha a série (hora ou dia, conforme a granularidade)
  private setupRowExpansion(container: HTMLElement): void {
    container.querySelectorAll<HTMLButtonElement>('.rp-expand').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.expandId;
        if (!id) return;
        if (this.expandedIds.has(id)) this.expandedIds.delete(id);
        else this.expandedIds.add(id);
        this.renderTable();
      });
    });
    container.querySelectorAll<HTMLElement>('.rp-series-row').forEach((tr) => {
      const id = tr.dataset.seriesFor;
      const box = tr.querySelector<HTMLElement>('.rp-series');
      if (id && box) void this.fillSeries(id, box);
    });
  }

  private async fillSeries(id: string, box: HTMLElement): Promise<void> {
    const row = this.data.find((r) => r.id === id);
    const gran = this.granularity;
    try {
      const points = await this.getDeviceSeries(id, gran);
      if (!box.isConnected) return;
      if (!points.length) {
        box.innerHTML = `<span class="rp-muted">Sem dados ${gran === '1h' ? 'horários' : 'diários'} no período.</span>`;
        return;
      }
      const fmtTs = (ts: number) =>
        gran === '1h'
          ? new Date(ts).toLocaleString('pt-BR', {
              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
              timeZone: 'America/Sao_Paulo',
            })
          : new Date(ts).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const valueLabel = this.isTemperature
        ? gran === '1h' ? 'Temperatura (°C)' : 'Média do dia (°C)'
        : this.domainConfig.label;
      box.innerHTML = `
        <table>
          <thead><tr><th>${gran === '1h' ? 'Data/Hora' : 'Dia'}</th><th class="num">${valueLabel}</th></tr></thead>
          <tbody>${points
            .map((p) => `<tr><td>${fmtTs(p.timestamp)}</td><td class="num">${fmtPt(p.value)}</td></tr>`)
            .join('')}</tbody>
        </table>`;
    } catch (err) {
      this.debugLog('❌ fillSeries', err);
      if (box.isConnected) {
        box.innerHTML = `<span class="rp-muted">Não foi possível carregar a série de ${row?.name || 'dispositivo'}.</span>`;
      }
    }
  }

  // Série do device na granularidade pedida. Temperatura: da série horária já calculada
  // (offset + descarte), agregada por dia em 1d. Energia/água: endpoint por device.
  private async getDeviceSeries(id: string, gran: '1h' | '1d'): Promise<SeriesPoint[]> {
    if (this.isTemperature) {
      const raw = this.temperatureStats.get(id)?.series || [];
      // A API devolve blocos de 15 min mesmo pedindo 1h → consolida em hora fechada
      return gran === '1h' ? this.aggregateHourly(raw, 'avg') : this.aggregateDaily(raw, 'avg');
    }
    const key = `${gran}|${id}`;
    const cached = this.deviceSeriesCache.get(key);
    if (cached) return cached;

    const startISO = this.exportPeriod?.startISO;
    const endISO = this.exportPeriod?.endISO;
    const token = this.params.api.ingestionToken;
    const baseUrl = this.params.api.dataApiBaseUrl;
    if (!startISO || !endISO || !token || !baseUrl) throw new Error('API/período indisponível');

    const url = `${baseUrl}/telemetry/devices/${id}/${this.domainConfig.endpoint}?startTime=${encodeURIComponent(startISO)}&endTime=${encodeURIComponent(endISO)}&granularity=${gran}&deep=0`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const parsed = this.parseSeries(body);
    // Hora fechada: pontos sub-horários somados por hora (consumo)
    const points = gran === '1h' ? this.aggregateHourly(parsed, 'sum') : parsed;
    this.deviceSeriesCache.set(key, points);
    return points;
  }

  private parseSeries(body: any): SeriesPoint[] {
    const ent = Array.isArray(body) ? body[0] : body;
    return ((ent?.consumption || []) as Array<{ timestamp: unknown; value: unknown }>)
      .map((p) => ({ timestamp: new Date(p?.timestamp as string | number).getTime(), value: Number(p?.value) }))
      .filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.value))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  // Consolida em HORA FECHADA (início da hora): média (temperatura) ou soma (consumo).
  // Fusos inteiros → a hora UTC coincide com a hora de São Paulo.
  private aggregateHourly(points: SeriesPoint[], mode: 'avg' | 'sum'): SeriesPoint[] {
    const HOUR = 3600 * 1000;
    const byHour = new Map<number, { sum: number; n: number }>();
    for (const p of points) {
      const h = Math.floor(p.timestamp / HOUR) * HOUR;
      const acc = byHour.get(h) || { sum: 0, n: 0 };
      acc.sum += p.value;
      acc.n += 1;
      byHour.set(h, acc);
    }
    return [...byHour.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([h, { sum, n }]) => ({ timestamp: h, value: mode === 'avg' ? sum / n : sum }));
  }

  // Agrega série horária por dia civil (São Paulo): média (temperatura) ou soma (consumo)
  private aggregateDaily(points: SeriesPoint[], mode: 'avg' | 'sum'): SeriesPoint[] {
    const byDay = new Map<number, { sum: number; n: number }>();
    for (const p of points) {
      const day = spDayStart(p.timestamp);
      const acc = byDay.get(day) || { sum: 0, n: 0 };
      acc.sum += p.value;
      acc.n += 1;
      byDay.set(day, acc);
    }
    return [...byDay.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([day, { sum, n }]) => ({ timestamp: day, value: mode === 'avg' ? sum / n : sum }));
  }

  // Resolve the chart palette from the host theme: createMyIOTheme exposes
  // tones(n) — solid hex tones derived from the dashboard accent. When absent
  // (or the accent is not hex), the component falls back to the MYIO palette.
  private resolveChartPalette(count: number): string[] | undefined {
    const theme = this.resolveThemeSource() as { tones?: (n: number) => string[] | null } | undefined;
    if (theme && typeof theme.tones === 'function') {
      const tones = theme.tones(count);
      if (Array.isArray(tones) && tones.length) return tones;
    }
    return undefined;
  }

  // Feeds the participation chart with the SAME rows the table shows
  // (exclusion toggle + filter modal selection + quick search all respected).
  // Created lazily on the first non-empty dataset; updated on every re-render.
  private updateParticipationChart(): void {
    const container = document.getElementById('participation-chart-container');
    if (!container) return;

    // Temperatura: "participação" não tem semântica → barras da média por sensor + faixa ideal
    if (this.isTemperature) {
      this.renderTemperatureChart(container);
      return;
    }

    const items = this.getFilteredData().map((row) => ({
      id: row.id || this.generateStoreId(row.identifier),
      label: row.name,
      value: row.consumption,
    }));

    if (!this.participationChart) {
      if (!items.length) return; // keep the "Carregue os dados..." placeholder
      document.getElementById('participation-chart-placeholder')?.remove();
      this.participationChart = createParticipationChart(container, {
        items,
        unit: this.domainConfig.unit,
        title: 'Participação por Dispositivo',
        chartType: 'pie',
        showTypeSelector: true,
        legend: { visible: true, position: 'bottom', selectable: true },
        tooltip: true,
        expandable: true,
        exportButtons: { visible: true, png: true, pdf: true },
        palette: this.resolveChartPalette(items.length),
        themeMode: this.params.ui?.theme === 'dark' ? 'dark' : 'light',
      });
      return;
    }

    const palette = this.resolveChartPalette(items.length);
    if (palette) this.participationChart.updateSettings({ palette });
    this.participationChart.updateData(items);
  }

  // Barras horizontais (HTML puro) da média por sensor, escala comum, faixa ideal sombreada
  private renderTemperatureChart(container: HTMLElement): void {
    const rows = this.getFilteredData();
    if (!rows.length) return;
    const withData = rows.filter((r) => !r.noData);
    const ideal = this.temperatureIdealRange;

    const values = withData.length ? withData.map((r) => r.consumption) : [20, 30];
    const lo = Math.floor(Math.min(...values, ideal ? ideal.min : Infinity) - 1);
    const hi = Math.ceil(Math.max(...values, ideal ? ideal.max : -Infinity) + 1);
    const span = Math.max(1, hi - lo);
    const pos = (v: number) => `${(((v - lo) / span) * 100).toFixed(2)}%`;

    const band = ideal
      ? `<div style="position:absolute;top:0;bottom:0;left:${pos(ideal.min)};width:calc(${pos(ideal.max)} - ${pos(ideal.min)});background:rgba(34,197,94,.15);border-left:1px dashed #22c55e;border-right:1px dashed #22c55e;"></div>`
      : '';

    const barColor = (v: number) =>
      ideal && v > ideal.max ? '#ef4444' : ideal && v < ideal.min ? '#3b82f6' : 'var(--myio-brand-700, #3e1a7d)';

    const lines = rows
      .map((r) => {
        const track = r.noData
          ? `<span class="rp-muted" style="font-size:11px;">Sem leitura</span>`
          : `<div style="position:relative;height:12px;background:var(--myio-border,#e5e7eb);border-radius:6px;overflow:hidden;">
               ${band}
               <div style="position:absolute;top:2px;bottom:2px;left:0;width:${pos(r.consumption)};background:${barColor(r.consumption)};border-radius:4px;opacity:.85;"></div>
             </div>`;
        return `
          <div style="display:grid;grid-template-columns:minmax(0,38%) 1fr 52px;gap:8px;align-items:center;margin-bottom:6px;font-size:12px;">
            <span title="${r.name}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.name}</span>
            ${track}
            <span style="text-align:right;font-variant-numeric:tabular-nums;font-weight:600;">${r.noData ? '—' : fmtPt(r.consumption)}</span>
          </div>`;
      })
      .join('');

    container.innerHTML = `
      <div style="border:1px solid var(--myio-border,#e5e7eb);border-radius:10px;padding:12px 14px;max-height:620px;overflow-y:auto;">
        <div style="font-weight:700;font-size:14px;margin-bottom:2px;">Temperatura média por sensor</div>
        <div style="font-size:11px;color:var(--myio-text-muted,#6b7280);margin-bottom:10px;">
          Escala ${fmtPt(lo)}–${fmtPt(hi)} °C${ideal ? ` · <span style="color:#16a34a;">faixa ideal ${fmtPt(ideal.min)}–${fmtPt(ideal.max)} °C</span>` : ''}
        </div>
        ${lines}
      </div>`;
  }

  // RFC-0182: Render rows grouped by groupLabel with section headers (Option B)
  private renderGroupedRows(rows: StoreReading[], grandTotal: number): string {
    // Preserve group order (order of first occurrence)
    const groupOrder: string[] = [];
    const byGroup = new Map<string, StoreReading[]>();

    for (const row of rows) {
      const g = row.groupLabel || '—';
      if (!byGroup.has(g)) {
        byGroup.set(g, []);
        groupOrder.push(g);
      }
      byGroup.get(g)!.push(row);
    }

    const showId = this.showIdentifierColumn();

    return groupOrder
      .map((groupLabel) => {
        const items = byGroup.get(groupLabel)!;

        // Temperatura: média dos sensores com leitura (nunca soma de médias)
        let summary: string;
        if (this.isTemperature) {
          const withData = items.filter((r) => !r.noData);
          const avg = withData.length ? withData.reduce((s, r) => s + r.consumption, 0) / withData.length : null;
          summary = `${items.length} sensores · média ${this.fmtTemp(avg)} °C`;
        } else {
          const groupTotal = items.reduce((s, r) => s + r.consumption, 0);
          summary = `${items.length} dispositivos · ${fmtPt(groupTotal)} ${this.domainConfig.unit}`;
        }

        const header = `
        <tr class="rp-group-header">
          <td colspan="${this.columnCount(showId)}">
            ${groupLabel}
            <span class="rp-group-total">${summary}</span>
          </td>
        </tr>`;

        return header + items.map((row) => this.renderRowHTML(row, grandTotal, showId)).join('');
      })
      .join('');
  }

  private getSortIcon(field: keyof StoreReading): string {
    if (this.sortField !== field) return '↕';
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  private getSortOpacity(field: keyof StoreReading): string {
    return this.sortField === field ? '1' : '0.5';
  }

  private setupTableSorting(): void {
    const headers = document.querySelectorAll('[data-sort]');
    headers.forEach((header) => {
      header.addEventListener('click', () => {
        const sortKey = header.getAttribute('data-sort') as keyof StoreReading;

        if (this.sortField === sortKey) {
          this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortField = sortKey;
          this.sortDirection = sortKey === 'identifier' || sortKey === 'name' ? 'asc' : 'desc';
        }

        this.currentPage = 1;
        this.renderTable();
        // RFC-0060: Removed pagination
      });
    });
  }

  private renderPagination(): void {
    // RFC-0060: Pagination removed - this function is now a no-op
  }

  private calculateTotalConsumption(): number {
    return this.data.reduce((sum, row) => sum + row.consumption, 0);
  }

  private openFilterModal(): void {
    if (!this.filterModal) {
      // Initialize filter modal with current data
      this.filterModal = attachFilterOrderingModal({
        title: 'Filtros & Ordenação - Dispositivos',
        items: this.convertToStoreItems(),
        unit: this.domainConfig.unit,
        initialSelected: Array.from(this.selectedStoreIds),
        initialSort: this.currentSortMode,
        onApply: ({ selected, sort }) => {
          this.applyFiltersAndSort(selected, sort);
        },
        onClose: () => {
          // Optional: handle close event
        },
      });
    } else {
      // Update existing modal with current data
      this.filterModal.setSelection(Array.from(this.selectedStoreIds));
      this.filterModal.setSort(this.currentSortMode);
    }

    this.filterModal.open();
  }

  private convertToStoreItems(): StoreItem[] {
    // RFC-0061: Detect duplicate labels to append identifier
    const labelCounts = new Map<string, number>();
    this.data.forEach((store) => {
      const count = labelCounts.get(store.name) || 0;
      labelCounts.set(store.name, count + 1);
    });

    return this.data.map((store) => {
      // If label appears more than once, append identifier in small italic font
      const isDuplicate = labelCounts.get(store.name)! > 1;
      const label = isDuplicate
        ? `${store.name} <span style="font-size: 7px; font-style: italic; color: #666;">(${store.identifier})</span>`
        : store.name;

      return {
        id: this.generateStoreId(store.identifier), // Use identifier for unique ID
        identifier: store.identifier,
        label: label,
        consumption: store.consumption,
      };
    });
  }

  private generateStoreId(storeName: string | undefined | null): string {
    // Generate consistent ID from store name or identifier
    const name = (storeName || 'SEM-ID').toString();
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[0300-036f]/g, '');
  }

  private applyFiltersAndSort(selectedIds: string[], sortMode: SortMode): void {
    this.selectedStoreIds = new Set(selectedIds);
    this.currentSortMode = sortMode;

    // Update internal sort fields based on SortMode
    switch (sortMode) {
      case 'CONSUMPTION_DESC':
        this.sortField = 'consumption';
        this.sortDirection = 'desc';
        break;
      case 'CONSUMPTION_ASC':
        this.sortField = 'consumption';
        this.sortDirection = 'asc';
        break;
      case 'ALPHA_ASC':
        this.sortField = 'name';
        this.sortDirection = 'asc';
        break;
      case 'ALPHA_DESC':
        this.sortField = 'name';
        this.sortDirection = 'desc';
        break;
    }

    // Reset to first page and re-render
    this.currentPage = 1;
    this.renderSummary();
    this.renderTable();
    // RFC-0060: Removed pagination

    // Update filter button to show active state
    const filterBtn = document.getElementById('filter-btn') as HTMLButtonElement;
    if (filterBtn && selectedIds.length > 0 && selectedIds.length < this.data.length) {
      filterBtn.innerHTML = `🔍 Filtros & Ordenação (${selectedIds.length})`;
      filterBtn.style.background = 'var(--myio-brand-600)'; // Darker purple for active state
    } else {
      filterBtn.innerHTML = '🔍 Filtros & Ordenação';
      filterBtn.style.background = 'var(--myio-brand-700)';
    }
  }

  private async exportCSV(): Promise<void> {
    // RFC-0060: Simplified CSV export - only header and data rows
    // Get all data (not just filtered/paginated) for export
    const sortedData = [...this.data].sort((a, b) => b.consumption - a.consumption);

    if (this.isTemperature) {
      this.exportTemperatureCSV(sortedData);
      return;
    }

    if (this.granularity === '1h') {
      await this.exportHourlyCSV(sortedData);
      return;
    }

    const csvData = [
      // Header row only
      ['Identificador', 'Nome', `Consumo (${this.domainConfig.unit})`],
      // Data rows
      ...sortedData.map((row) => [row.identifier, row.name, row.consumption.toFixed(2)]),
    ];

    const csvContent = toCsv(csvData);
    this.downloadCSV(csvContent, `relatorio-geral-lojas-${new Date().toISOString().split('T')[0]}.csv`);
  }

  // Temperatura: valores já com offset e sem leituras inválidas (mesma base da tabela).
  // 1d → uma linha por sensor por DIA; 1h → uma linha por sensor por HORA.
  private exportTemperatureCSV(rows: StoreReading[]): void {
    const showId = this.showIdentifierColumn(rows);
    const idCol = (r: StoreReading) => (showId ? [r.identifier] : []);
    const idHead = showId ? ['Identificador'] : [];
    const n2 = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? '' : v.toFixed(2));
    const date = new Date().toISOString().split('T')[0];
    const fmtStamp = (ts: number) => {
      const { date: d, time } = this.formatSpDateTime(ts);
      return `${d} ${time}`;
    };

    // Resumo do período por sensor
    const summary: string[][] = [
      [...idHead, 'Sensor', 'Média (°C)', 'Mín (°C)', 'Data/Hora Mín', 'Máx (°C)', 'Data/Hora Máx', 'Leituras', 'Leituras descartadas'],
      ...rows.map((r) => [
        ...idCol(r),
        r.name,
        r.noData ? 'Sem leitura' : n2(r.consumption),
        r.noData ? '' : n2(r.min),
        r.noData || !r.minTs ? '' : fmtStamp(r.minTs),
        r.noData ? '' : n2(r.max),
        r.noData || !r.maxTs ? '' : fmtStamp(r.maxTs),
        String(r.readings ?? ''),
        String(r.discarded ?? ''),
      ]),
    ];

    const gran = this.granularity;
    const series: string[][] = [[...idHead, 'Sensor', gran === '1h' ? 'Data/Hora' : 'Dia', 'Temperatura (°C)']];
    const fmtTs = (ts: number) =>
      gran === '1h'
        ? new Date(ts).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
            timeZone: 'America/Sao_Paulo',
          })
        : new Date(ts).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    for (const r of rows) {
      const raw = (r.id && this.temperatureStats.get(r.id)?.series) || [];
      const pts = gran === '1h' ? this.aggregateHourly(raw, 'avg') : this.aggregateDaily(raw, 'avg');
      for (const p of pts) series.push([...idCol(r), r.name, fmtTs(p.timestamp), p.value.toFixed(2)]);
    }

    // Um arquivo: resumo + linha em branco + série (Excel abre os dois blocos)
    const csvContent = toCsv([...summary, [], ...series]);
    this.downloadCSV(csvContent, `relatorio-temperatura-${gran}-${date}.csv`);
  }

  // 1h CSV: one row per device × hour. The series comes from per-device requests
  // (/telemetry/devices/{id}/{endpoint}?granularity=1h) fetched lazily at export time
  // and cached per period — /totals cannot provide hourly data.
  private async exportHourlyCSV(sortedData: StoreReading[]): Promise<void> {
    const exportBtn = document.getElementById('export-btn') as HTMLButtonElement | null;
    const originalHtml = exportBtn?.innerHTML;
    if (exportBtn) {
      exportBtn.disabled = true;
      exportBtn.innerHTML = '<span class="myio-spinner" style="display:inline-block;"></span> CSV…';
    }

    try {
      const series = await this.ensureHourlySeries(sortedData);

      const fmtTs = (ts: number) => {
        const d = new Date(ts);
        return (
          d.toLocaleDateString('pt-BR') +
          ' ' +
          d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        );
      };

      const csvData: string[][] = [
        ['Identificador', 'Nome', 'Data/Hora', `Consumo (${this.domainConfig.unit})`],
      ];
      for (const row of sortedData) {
        const points = (row.id && series.get(row.id)) || [];
        for (const p of points) {
          csvData.push([row.identifier, row.name, fmtTs(p.timestamp), p.value.toFixed(2)]);
        }
      }

      if (csvData.length === 1) {
        this.showError('Nenhum dado horário disponível para o período selecionado.');
        return;
      }

      const csvContent = toCsv(csvData);
      this.downloadCSV(
        csvContent,
        `relatorio-geral-lojas-1h-${new Date().toISOString().split('T')[0]}.csv`
      );
    } catch (error) {
      this.debugLog('❌ Error in exportHourlyCSV', error);
      this.showError('Erro ao buscar dados horários para o CSV. Tente novamente.');
    } finally {
      if (exportBtn) {
        exportBtn.disabled = false;
        if (originalHtml) exportBtn.innerHTML = originalHtml;
      }
    }
  }

  // Fetches (or reuses) the per-device hourly series for the current export period.
  // Same batching pattern as enrichTemperatureAverages (6 concurrent requests).
  private async ensureHourlySeries(
    rows: StoreReading[]
  ): Promise<Map<string, Array<{ timestamp: number; value: number }>>> {
    const startISO = this.exportPeriod?.startISO;
    const endISO = this.exportPeriod?.endISO;
    if (!startISO || !endISO) throw new Error('Período de exportação indisponível');

    // Key includes the device set: the exclusion toggle changes rows without a reload.
    const idsKey = rows
      .map((r) => r.id)
      .filter(Boolean)
      .sort()
      .join(',');
    const cacheKey = `${startISO}|${endISO}|${idsKey}`;
    if (this.hourlySeriesCache?.key === cacheKey) return this.hourlySeriesCache.series;

    const token = this.params.api.ingestionToken;
    const baseUrl = this.params.api.dataApiBaseUrl;
    if (!token || !baseUrl) throw new Error('API não configurada para busca por device');

    const endpoint = this.domainConfig.endpoint;
    const startTime = encodeURIComponent(startISO);
    const endTime = encodeURIComponent(endISO);
    const series = new Map<string, Array<{ timestamp: number; value: number }>>();

    const targets = rows.filter((r) => r.id);
    const BATCH = 6;
    for (let i = 0; i < targets.length; i += BATCH) {
      await Promise.all(
        targets.slice(i, i + BATCH).map(async (row) => {
          try {
            const url = `${baseUrl}/telemetry/devices/${row.id}/${endpoint}?startTime=${startTime}&endTime=${endTime}&granularity=1h&deep=0`;
            const res = await fetch(url, {
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            if (!res.ok) return;
            const body = await res.json();
            const ent = Array.isArray(body) ? body[0] : body;
            const points = ((ent?.consumption || []) as Array<{ timestamp: unknown; value: unknown }>)
              .map((p) => ({ timestamp: new Date(p?.timestamp as string | number).getTime(), value: Number(p?.value) }))
              .filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.value));
            // Hora fechada (soma dos pontos sub-horários)
            if (points.length) series.set(row.id!, this.aggregateHourly(points, 'sum'));
          } catch {
            /* device sem série no período — fica de fora do CSV */
          }
        })
      );
    }

    this.debugLog(`[AllReportModal] 1h series fetched for ${series.size}/${targets.length} devices`);
    this.hourlySeriesCache = { key: cacheKey, series };
    return series;
  }

  // Maps the report rows to the TelemetryDevice shape consumed by the shared
  // TELEMETRY grid exporters (only labelOrName/name/deviceIdentifier/val/perc are read).
  private buildExportDevices(): TelemetryDevice[] {
    const sorted = [...this.data].sort((a, b) =>
      !!a.noData !== !!b.noData ? (a.noData ? 1 : -1) : b.consumption - a.consumption
    );
    const total = sorted.reduce((s, r) => s + (r.consumption || 0), 0);
    return sorted.map((r) => ({
      labelOrName: r.name,
      name: r.name,
      deviceIdentifier: r.identifier,
      // Temperatura: média do sensor (sem leitura → "—"); sem % de participação
      val: this.isTemperature && r.noData ? null : r.consumption,
      perc: this.isTemperature ? undefined : total > 0 ? (r.consumption / total) * 100 : 0,
    })) as unknown as TelemetryDevice[];
  }

  // Colunas do PDF/XLS: temperatura = Sensor | Temperatura média (sem %, Identificador só se útil)
  private exportColumns(): { valueLabel?: string; hidePerc?: boolean; hideIdentifier?: boolean; nameLabel?: string } | null {
    if (!this.isTemperature) return null;
    return {
      nameLabel: 'Sensor',
      valueLabel: 'Temperatura média (°C)',
      hidePerc: true,
      hideIdentifier: !this.showIdentifierColumn(),
    };
  }

  // Accent hex da paleta do dashboard (tema efetivo) para o PDF/XLS — cai no
  // roxo MYIO default quando não há tema configurado.
  private resolveAccentHex(): string | undefined {
    const theme = this.resolveThemeSource() as
      | { accent?: string; cssVars?: () => Record<string, string> }
      | Record<string, string>
      | undefined;
    if (!theme) return undefined;
    if (typeof (theme as { accent?: string }).accent === 'string') {
      return (theme as { accent: string }).accent;
    }
    const vars =
      typeof (theme as { cssVars?: () => Record<string, string> }).cssVars === 'function'
        ? (theme as { cssVars(): Record<string, string> }).cssVars()
        : (theme as Record<string, string>);
    return vars?.['--myio-brand-700'];
  }

  // PDF export — layout premium do grid + paleta do dashboard + faixa de KPIs +
  // página dedicada com o gráfico de participação da modal.
  private async exportPDF(): Promise<void> {
    if (!this.data.length) return;

    const chartPng = await this.participationChart?.toPngDataUrl?.().catch(() => null);

    exportGridPdf(
      this.buildExportDevices(),
      this.resolveTitle(),
      this.domainConfig.unit,
      this.exportPeriod,
      null,
      {
        accentColor: this.resolveAccentHex(),
        kpis: this.computeKpis(),
        columns: this.exportColumns(),
        chartImage: chartPng
          ? { ...chartPng, title: 'Participação por Dispositivo' }
          : null,
      },
    );
  }

  // XLS export (XML Spreadsheet) — same as the TELEMETRY grid export.
  private exportXLS(): void {
    if (!this.data.length) return;
    exportGridXls(
      this.buildExportDevices(),
      this.resolveTitle(),
      this.domainConfig.unit,
      this.exportPeriod,
      null,
      { accentColor: this.resolveAccentHex(), columns: this.exportColumns() },
    );
  }

  private async fetchCustomerTotals(startISO: string, endISO: string): Promise<any> {
    // Check if custom fetcher is provided (for testing/demo)
    if (this.params.fetcher) {
      // Use ingestionToken for Data API endpoints (data.apps.myio-bas.com)
      const token = this.params.api.ingestionToken || (await this.authClient.getBearer());
      const baseUrl = this.params.api.dataApiBaseUrl;
      if (!baseUrl) throw new Error('dataApiBaseUrl não configurado.');
      return await this.params.fetcher({
        baseUrl,
        token: token,
        customerId: this.params.customerId,
        startISO,
        endISO,
      });
    }

    // Real Customer Totals API implementation
    // Use ingestionToken for Data API endpoints (data.apps.myio-bas.com)
    const token = this.params.api.ingestionToken;
    if (!token) {
      throw new Error('ingestionToken is required for Data API calls to data.apps.myio-bas.com');
    }

    const baseUrl = this.params.api.dataApiBaseUrl;
    if (!baseUrl) throw new Error('dataApiBaseUrl não configurado.');

    // Format timestamps for API call
    const startTime = encodeURIComponent(startISO);
    const endTime = encodeURIComponent(endISO);

    const endpoint = this.domainConfig.endpoint;
    // /totals does NOT support hourly granularity — always fetch daily. The 1h selection
    // only affects the CSV export, which fetches per-device series separately.
    const url = `${baseUrl}/telemetry/customers/${this.params.customerId}/${endpoint}/devices/totals?startTime=${startTime}&endTime=${endTime}&granularity=1d`;

    this.debugLog('[AllReportModal] Fetching customer totals:', {
      url,
      customerId: this.params.customerId,
      domain: this.params.domain || 'energy',
    });

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        // Using ingestionToken for Data API endpoints (data.apps.myio-bas.com)
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    this.debugLog('[AllReportModal] Customer totals response:', data);

    // ED-996: /temperature/devices/totals retorna total_value=0 para sensores de
    // temperatura ("total" não é semântica de temperatura) — substitui pelo valor
    // MÉDIO do período de cada sensor, via o mesmo endpoint por device usado no
    // modal de histórico do card (que funciona).
    if ((this.params.domain || 'energy') === 'temperature') {
      await this.enrichTemperatureAverages(data, startISO, endISO, token, baseUrl);
    }

    return data;
  }

  // ED-996: busca a série de temperatura de cada sensor e escreve a MÉDIA do período
  // em total_value (in-place). Sensores sem série ficam com o 0 original.
  private async enrichTemperatureAverages(
    data: any,
    startISO: string,
    endISO: string,
    token: string,
    baseUrl: string
  ): Promise<void> {
    const rows: any[] = Array.isArray(data?.data) ? data.data : [];
    // Com itemsList (MENU), ELE define quem é sensor: há termostatos cadastrados no Ingestion
    // com deviceType "energy" (ex.: Shopping da Ilha) — filtrar por deviceType pulava todos
    // (sem offset, sem descarte, sem mín/máx). Sem itemsList: só deviceType 'temperature'.
    let tempRows: any[];
    if (this.params.itemsList) {
      const ids = new Set(this.params.itemsList.map((i) => String(i.id)));
      tempRows = rows.filter((d) => ids.has(String(d?.id)));
    } else {
      tempRows = rows.filter((d) => String(d?.deviceType || '').toLowerCase() === 'temperature');
    }
    if (!tempRows.length) return;

    // Sempre a série HORÁRIA: base da média, do mín/máx, da expansão (1h ou 1d agregado) e do CSV
    const startTime = encodeURIComponent(startISO);
    const endTime = encodeURIComponent(endISO);
    const valid = this.temperatureValidRange;
    const BATCH = 6;

    for (let i = 0; i < tempRows.length; i += BATCH) {
      await Promise.all(
        tempRows.slice(i, i + BATCH).map(async (dev) => {
          const id = String(dev.id);
          const offset = this.temperatureOffsetFor(id);
          try {
            const url = `${baseUrl}/telemetry/devices/${id}/temperature?startTime=${startTime}&endTime=${endTime}&granularity=1h&deep=0`;
            const res = await fetch(url, {
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const stats = this.computeTemperatureStats(this.parseSeries(await res.json()), offset, valid);
            this.temperatureStats.set(id, stats);
            dev.total_value = stats.avg; // null = nenhuma leitura válida no período
          } catch {
            // Série indisponível: média da rota /totals + offset (sem descarte de inválidas)
            const avg = dev.total_value === null || dev.total_value === undefined ? NaN : Number(dev.total_value);
            dev.total_value = Number.isFinite(avg) ? avg + offset : null;
          }
        })
      );
    }
    this.debugLog(`[AllReportModal] ED-996: temperaturas médias aplicadas a ${tempRows.length} sensores`);
  }

  // Offset somado a cada leitura; leituras fora da faixa válida são descartadas (contadas)
  private computeTemperatureStats(
    raw: SeriesPoint[],
    offset: number,
    valid: { min: number; max: number }
  ): TemperatureStats {
    const series: SeriesPoint[] = [];
    let discarded = 0;
    for (const p of raw) {
      const v = p.value + offset;
      if (v < valid.min || v > valid.max) discarded++;
      else series.push({ timestamp: p.timestamp, value: v });
    }
    if (!series.length) {
      return { avg: null, min: null, max: null, minTs: null, maxTs: null, readings: 0, discarded, series };
    }
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    let minTs = series[0].timestamp;
    let maxTs = series[0].timestamp;
    for (const p of series) {
      sum += p.value;
      if (p.value < min) {
        min = p.value;
        minTs = p.timestamp;
      }
      if (p.value > max) {
        max = p.value;
        maxTs = p.timestamp;
      }
    }
    return { avg: sum / series.length, min, max, minTs, maxTs, readings: series.length, discarded, series };
  }

  // Re-map the cached API response under the current exclusion flag and refresh the UI.
  // No-op until data has been loaded at least once.
  private remapAndRender(): void {
    if (!this.lastApiResponse) return;
    this.data = this.mapCustomerTotalsResponse(this.lastApiResponse);
    this.selectedStoreIds = new Set(this.data.map((s) => this.generateStoreId(s.identifier)));
    this.currentPage = 1;
    this.renderSummary();
    this.renderTable();
  }

  // Premium tooltip content for the exclusion-flag info icon. Uses the library
  // InfoTooltip CSS classes (myio-info-tooltip__*) — injected by InfoTooltip itself.
  private buildExclusionTooltipContent(): string {
    // Plain <p> blocks — the library's __row/__label pair uses flex + flex-shrink:0
    // on the label, so long text won't wrap there. Block paragraphs wrap normally.
    const p = 'margin:0 0 8px;font-size:11px;line-height:1.5;color:#475569;';
    const pLast = 'margin:0;font-size:11px;line-height:1.5;color:#475569;';
    return `
      <div class="myio-info-tooltip__section" style="max-width:280px;">
        <p style="${p}">
          Alguns dispositivos têm o atributo <strong>exclude_groups_totals</strong> e são
          propositalmente removidos dos totais do dashboard (ex.: medidor de locatário que
          não é consumo operacional do shopping).
        </p>
        <p style="${p}">
          <strong>Ligado</strong> (padrão): esses dispositivos são omitidos do relatório —
          o total bate com os cards do dashboard.
        </p>
        <p style="${pLast}">
          <strong>Desligado</strong>: todos os dispositivos do grupo entram — mostra o
          consumo bruto, inclusive os excluídos.
        </p>
      </div>
      <div class="myio-info-tooltip__notice">
        <span class="myio-info-tooltip__notice-icon">💡</span>
        <span>Não altera nenhum dado — apenas o que o relatório soma e lista.</span>
      </div>
    `;
  }

  // Resolve the canonical `exclude_groups_totals.groups` key for the report's current group.
  // Returns null for groupings that don't map to a single exclusion key (climatizavel, etc.).
  private resolveExclusionGroupKey(item: StoreItem): string | null {
    const g = String(this.params.group || '').toLowerCase();
    if (g === 'entrada' || g === 'lojas' || g === 'area_comum') return g;
    if (g === 'todos') {
      const gl = String(item.groupLabel || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim();
      if (gl === 'entrada') return 'entrada';
      if (gl === 'lojas') return 'lojas';
      if (gl === 'area comum' || gl === 'areacomum') return 'area_comum';
      if (gl === 'climatizacao') return 'climatizacao';
      if (gl === 'elevadores') return 'elevadores';
      if (gl === 'escadas rolantes' || gl === 'esc. rolantes') return 'escadas_rolantes';
      if (gl === 'outros' || gl === 'outros equipamentos') return 'outros';
    }
    return null;
  }

  // Mirrors getValorEfetivo (MAIN_VIEW): a device flagged in exclude_groups_totals for the
  // report's group is dropped, so the report total reconciles with the dashboard KPI card.
  private isExcludedFromTotals(item: StoreItem): boolean {
    const raw = item.excludeGroupsTotals;
    if (!raw) return false;

    let parsed: any;
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return false;
    }
    if (!parsed || parsed.enabled !== true) return false;

    const key = this.resolveExclusionGroupKey(item);
    if (!key) return false;

    if (parsed.groups && typeof parsed.groups === 'object') {
      return parsed.groups[key] === true;
    }
    // Legacy format: { enabled, excludedGroups: [...] }
    if (Array.isArray(parsed.excludedGroups)) {
      const ex = parsed.excludedGroups.map((x: any) => String(x).toLowerCase());
      return ex.includes(key) || ex.includes('all');
    }
    return false;
  }

  private mapCustomerTotalsResponse(apiResponse: any): StoreReading[] {
    this.debugLog('🔍 Starting mapCustomerTotalsResponse', { apiResponse });

    // 1) Extract API data array
    const apiArray: any[] = Array.isArray(apiResponse?.data)
      ? apiResponse.data
      : Array.isArray(apiResponse)
        ? apiResponse
        : [];

    // Always log this for debugging (survives minification)
    this.debugLog('[AllReportModal] NEW MAPPING - API array length:', apiArray.length);
    this.debugLog(
      '[AllReportModal] NEW MAPPING - ItemsList length:',
      this.params.itemsList?.length ?? 'N/A (direct mode)'
    );

    this.debugLog('📋 API data array extracted', {
      isDataProperty: !!apiResponse?.data,
      isDirectArray: Array.isArray(apiResponse),
      apiArrayLength: apiArray.length,
      firstFewItems: apiArray.slice(0, 3),
    });

    if (!apiArray.length) {
      this.debugLog('⚠️ Empty API array, returning empty result');
      this.debugLog('[AllReportModal] Empty/invalid API response:', apiResponse);
      return [];
    }

    // 2a) When no itemsList is provided (undefined/null), map directly from the API array.
    //     An explicitly provided empty itemsList means the group has no devices → return [].
    if (!this.params.itemsList) {
      this.debugLog('📋 No itemsList provided — mapping directly from API array');
      return apiArray.map((item) =>
        this.decorateTemperatureRow(
          {
            identifier: item.assetName || this.resolveStoreIdentifierFromApi(item) || item.id || '',
            name: item.name || item.assetName || item.id || '',
            consumption: this.pickConsumption(item),
            ...(item.id ? { id: String(item.id) } : {}),
          },
          item
        )
      );
    }

    // 2b) API-driven filter: keep only API items whose id matches an orchestrator ingestionId.
    //     Discards API items that don't belong to this group (e.g. area_comum filters out lojas,
    //     entrada, etc. from the full 271-device energy response).
    //     Uses total_value from the API item (picked via pickConsumption).

    // Build O(1) lookup structures from itemsList
    const orchIdSet = new Set(this.params.itemsList.map((item) => String(item.id)));
    const orchMeta  = new Map(this.params.itemsList.map((item) => [String(item.id), item]));

    this.debugLog('[AllReportModal] API-driven filter — orchestrator devices:', orchIdSet.size);
    this.debugLog('[AllReportModal] API-driven filter — API total devices:', apiArray.length);

    const rows: StoreReading[] = [];
    let totalMappedConsumption = 0;

    for (const apiItem of apiArray) {
      const apiId = String(apiItem?.id || '');
      if (!apiId || !orchIdSet.has(apiId)) continue; // discard: not in this group

      const meta        = orchMeta.get(apiId);

      // RFC-0128: drop devices flagged via exclude_groups_totals for this group, so the
      // report total reconciles with the dashboard KPI card (which honors the same attribute).
      if (this.considerExclusion && meta && this.isExcludedFromTotals(meta)) {
        this.debugLog('[AllReportModal] device excluded via exclude_groups_totals:', meta.label);
        continue;
      }

      const consumption = Math.round(this.pickConsumption(apiItem) * 100) / 100;

      const result: StoreReading = this.decorateTemperatureRow(
        {
          identifier: meta?.identifier || apiItem.name || apiId,
          name:       meta?.label      || apiItem.name || apiId,
          consumption,
          id: apiId,
          ...(meta?.groupLabel ? { groupLabel: meta.groupLabel } : {}),
        },
        apiItem
      );

      totalMappedConsumption += result.consumption;
      rows.push(result);
    }

    this.debugLog('[AllReportModal] API-driven filter', {
      matched: rows.length,
      discarded: apiArray.length - rows.length,
      totalConsumption: totalMappedConsumption,
    });

    return rows;
  }

  // Temperatura: média null/NaN → "Sem leitura" (nunca 0 °C); anexa mín/máx/contagens
  private decorateTemperatureRow(row: StoreReading, apiItem: any): StoreReading {
    if (!this.isTemperature) return row;
    const avg = apiItem?.total_value;
    const hasAvg = avg !== null && avg !== undefined && Number.isFinite(Number(avg));
    const stats = row.id ? this.temperatureStats.get(row.id) : undefined;
    return {
      ...row,
      consumption: hasAvg ? Math.round(Number(avg) * 100) / 100 : 0,
      noData: !hasAvg,
      ...(stats && stats.min !== null ? { min: Math.round(stats.min * 100) / 100, minTs: stats.minTs ?? undefined } : {}),
      ...(stats && stats.max !== null ? { max: Math.round(stats.max * 100) / 100, maxTs: stats.maxTs ?? undefined } : {}),
      ...(stats ? { readings: stats.readings, discarded: stats.discarded } : {}),
    };
  }

  private parseConsumptionValue(item: any): number {
    // Try various possible field names for consumption value
    const possibleFields = ['total_value', 'totalValue', 'consumption', 'value', 'total', 'energy', 'kwh'];

    for (const field of possibleFields) {
      if (item[field] !== undefined && item[field] !== null) {
        const value =
          typeof item[field] === 'string' ? parseFloat(item[field].replace(',', '.')) : Number(item[field]);

        if (!isNaN(value)) {
          return Math.round(value * 100) / 100; // Round to 2 decimal places
        }
      }
    }

    this.debugLog('[AllReportModal] No valid consumption value found in item:', item);
    return 0;
  }

  private downloadCSV(content: string, filename: string): void {
    // Add UTF-8 BOM to ensure proper encoding of special characters
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + content;
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private getDefaultStartDate(): string {
    const date = new Date();
    date.setDate(1); // First day of current month
    return date.toISOString().split('T')[0];
  }

  private getDefaultEndDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  private showError(message: string): void {
    const container = document.getElementById('error-container');
    if (container) {
      container.textContent = message;
      container.style.display = 'block';
    }
  }

  private hideError(): void {
    const container = document.getElementById('error-container');
    if (container) {
      container.style.display = 'none';
    }
  }

  private on(event: string, handler: () => void): void {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }

  private emit(event: string, payload?: any): void {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach((handler) => handler());
    }
  }
}
