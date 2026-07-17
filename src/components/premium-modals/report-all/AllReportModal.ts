// report-all/AllReportModal.ts
import { createModal } from '../internal/ModalPremiumShell';
import { toISOWithOffset, rangeDaysInclusive, toDayKey, toHourKey } from '../internal/engines/DateEngine';
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
import { createReportModeSelector } from '../internal/report-mode-selector';
import type { ReportModeSelectorInstance } from '../internal/report-mode-selector';
import { renderCollapsibleSectionHeader, renderCollapsibleLeafRow, injectCollapsibleSectionStyles, escapeHtml } from '../internal/collapsible-section';
import { createModalFooter } from '../footer-modal';
import type { ModalFooterInstance } from '../footer-modal';

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
}

// RFC-0223: per-device/day/hour section tree — the single source every
// consumer (sectioned grid, KPIs, participation chart) reads from, so totals
// reconcile with the visible rows by construction instead of by independent
// implementations happening to agree (AC18).
interface ReportSectionHourNode {
  key: string; // 'YYYY-MM-DDTHH'
  label: string; // 'HH:00'
  value: number | null; // null only for temperature with no reading that hour
  excluded: boolean; // Períodos filter (P4) — false until then
}

interface ReportSectionDayNode {
  key: string; // 'YYYY-MM-DD'
  label: string; // 'DD/MM'
  value: number | null;
  hours?: ReportSectionHourNode[]; // present only when granularity === '1h'
  excluded: boolean;
}

interface ReportSectionDeviceNode {
  row: StoreReading;
  days: ReportSectionDayNode[]; // [] when coverage !== 'ok' or the device has zero readings
  total: number | null;
  dayCount: number; // AC16: 0 for a genuinely-empty or failed device
  coverage: 'ok' | 'partial' | 'failed';
}

interface ReportSectionGroupNode {
  groupLabel: string; // '—' when ungrouped (mirrors renderGroupedRows' own convention)
  devices: ReportSectionDeviceNode[];
  total: number | null;
}

interface ReportSectionModel {
  groups: ReportSectionGroupNode[];
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

  // RFC-0223: legacy 2-way granularity, now DERIVED from reportMode (never
  // assigned directly — the old onChange write site was removed when
  // ReportModeSelector replaced the bare granularity toggle). Kept as a
  // read-only getter, not deleted, so existing internal readers (exportCSV's
  // 1h branch, enrichTemperatureAverages) keep compiling and behaving exactly
  // as before for any reportMode other than 'consolidado'.
  private get granularity(): '1d' | '1h' {
    return this.reportMode === '1h' ? '1h' : '1d';
  }

  // RFC-0223: tz used for day/hour bucket keys — params.api.timezone override,
  // default América/São_Paulo (matches BaseApiCfg's documented default).
  private get timezone(): string {
    return this.params.api.timezone || 'America/Sao_Paulo';
  }

  // RFC-0223: report temporal resolution. 'consolidado' (default) preserves today's
  // behavior byte-for-byte — no per-device series fetch, single aggregate row per device.
  private reportMode: 'consolidado' | '1d' | '1h' = 'consolidado';

  // RFC-0223: per-device raw point series for 1d/1h sections (grid + PDF + CSV).
  // Absorbs the old hourlySeriesCache/ensureHourlySeries (single-purpose, 1h-only,
  // CSV-export-only) — this is the same batched-fetch mechanism generalized to
  // also drive the on-screen sectioned grid at either granularity. Raw points are
  // cached (NOT pre-bucketed into day/hour trees) so exportHourlyCSV's existing
  // per-point consumer stays valid and day/hour buckets stay a single derived
  // view (bucketByDay), never a second stored representation that could drift
  // from the raw series.
  // Cache key: `${startISO}|${endISO}|${granularity}|${idsKey}` (idsKey mirrors
  // the old hourlySeriesCache's sorted-device-id-list convention).
  // Invalidated only by a full load, a mode switch, or a device-set change — an
  // excludedDays/excludedHours change is a pure client-side recompute and never
  // invalidates it.
  private deviceSeriesCache: {
    key: string;
    granularity: '1d' | '1h';
    raw: Map<string, Array<{ timestamp: number; value: number }>>;
    // Per-device fetch outcome so a swallowed failure never reads as "0 consumo".
    coverage: Map<string, 'ok' | 'partial' | 'failed'>;
  } | null = null;

  // RFC-0223: temporal (day/hour) Períodos filter. Empty set means "all included".
  // Keys are derived via the shared tz-aware toDayKey/toHourKey formatter so they
  // line up with both the visible day labels and the 1d server buckets.
  private excludedDays: Set<string> = new Set(); // 'YYYY-MM-DD'
  private excludedHours: Set<string> = new Set(); // 'YYYY-MM-DDTHH'

  // RFC-0223: collapse state for group/device/day sections:
  // `grp:<uri-encoded groupLabel>` | `dev:<uri-encoded id-or-identifier>` |
  // `dev:<...>#day:<YYYY-MM-DD>`. Group keys are necessarily label-based (a
  // group has no separate stable id) — see sectionGroupKey/
  // sectionDeviceCollapseKey — URI-encoded specifically so a label/identifier
  // containing a literal space (e.g. "Área Comum") can't split into more than
  // one token when applySectionVisibility parses `data-ancestors` back with
  // `.split(' ')` (code review H1).
  private collapsedSections: Set<string> = new Set();
  // Identifies the period+mode this collapse state belongs to
  // (`${startISO}|${endISO}|${reportMode}`) — a loadData()/mode change compares
  // against this and resets collapsedSections to the AC6 defaults on mismatch; a
  // Períodos filter apply re-renders without touching it, so carets persist.
  private collapsedSectionsEpoch: string | null = null;

  // RFC-0223: memoizes buildReportSectionModel() for the current render pass —
  // every 1d/1h consumer (renderSectionedRows, computeKpis,
  // updateParticipationChart, getEffectiveDeviceTotal) calls getReportSectionModel()
  // instead of rebuilding the O(devices × days × hours) tree once per row.
  // buildReportSectionModel() itself stays a pure, directly-testable function.
  private sectionModelCache: { key: string; model: ReportSectionModel } | null = null;

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
  // RFC-0223: Consolidado | Diário | Horário selector (wraps granularity-selector).
  private reportModeSelector: ReportModeSelectorInstance | null = null;
  // Footer premium: Customer · relógio · versão | Powered by MYIO | PDF/CSV/XLSX.
  // Os botões de export vivem AQUI (removidos da toolbar).
  private modalFooter: ModalFooterInstance | null = null;

  constructor(private params: OpenAllReportParams) {
    this.authClient = new AuthClient({
      clientId: params.api.clientId,
      clientSecret: params.api.clientSecret,
      base: params.api.dataApiBaseUrl,
    });

    // Set domain configuration
    const domain = params.domain || 'energy';
    this.domainConfig = DOMAIN_CONFIG[domain];

    // Set debug flag from params (1 = enabled, 0 = disabled)
    this.debugEnabled = params.debug === 1;

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

      // Cleanup report-mode selector (RFC-0223: also destroys the nested
      // granularity-selector + its tooltip). Reopening always starts at
      // Consolidado (reportMode is reset in the constructor's field initializer,
      // and a fresh AllReportModal instance is created per openDashboardPopupAllReport call).
      if (this.reportModeSelector) {
        this.reportModeSelector.destroy();
        this.reportModeSelector = null;
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
              <div id="report-mode-toggle" style="display: flex; align-items: center;"></div>
            </div>
            <button id="load-btn" class="myio-btn myio-btn-primary">
              <span class="myio-spinner" id="load-spinner" style="display: none;"></span>
              Carregar
            </button>
            <!-- Exports CSV/PDF/XLS vivem no footer premium (createModalFooter) -->
            <button id="filter-btn" class="myio-btn myio-btn-secondary" style="background: var(--myio-brand-700); color: white;">
              🔍 Filtros & Ordenação
            </button>
            <!-- RFC-0223: Períodos filter + collapse-all — hidden until reportMode !== 'consolidado' -->
            <button id="periods-filter-btn" class="myio-btn myio-btn-secondary" style="display: none; background: var(--myio-brand-700); color: white;">
              📅 Períodos
            </button>
            <button id="collapse-all-btn" class="myio-btn myio-btn-secondary" style="display: none;">
              Recolher tudo
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

    // RFC-0223: collapse-all/expand-all — next-action-driven label (AC7).
    const collapseAllBtn = document.getElementById('collapse-all-btn') as HTMLButtonElement | null;
    collapseAllBtn?.addEventListener('click', () => {
      if (this.collapsedSections.size > 0) this.expandAllSections();
      else this.collapseAllSections();
    });

    // RFC-0223: Consolidado | Diário | Horário selector, replacing the bare
    // 2-way granularity toggle. Consolidado keeps today's aggregate path
    // (byte-for-byte, no per-device series fetch); Diário/Horário drive the
    // sectioned grid built out in later stages. onChange only resets the
    // series cache and re-renders — the actual fetch/branch happens in
    // loadData()/renderTable() once reportMode !== 'consolidado' is handled there.
    const modeToggle = document.getElementById('report-mode-toggle');
    if (modeToggle) {
      this.reportModeSelector?.destroy();
      this.reportModeSelector = createReportModeSelector(modeToggle, {
        settings: {
          value: this.reportMode,
          themeMode: this.params.ui?.theme === 'dark' ? 'dark' : 'light',
          // RFC-0223 delivery phases: this PR ships P1 (Diário) only — Horário
          // stays hidden until its own PR (P3, hourly drill-down) lands.
          horarioEnabled: false,
        },
        onChange: async (value) => {
          this.reportMode = value;
          this.deviceSeriesCache = null;
          this.sectionModelCache = null;
          if (!this.data.length) return;
          await this.ensureDeviceSeriesForCurrentMode();
          this.resetCollapsedSectionsIfEpochChanged();
          this.renderSummary();
          this.renderTable();
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
      void this.remapAndRender();
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
        maxRangeDays: 31,
        parentEl: this.modal.element,
        onApply: ({ startISO, endISO }) => {
          this.hideError();
          this.debugLog('Date range selected:', { startISO, endISO });
        },
      });
    } catch (error) {
      this.debugLog('DateRangePicker initialization failed, using fallback:', error);
    }
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
      const { startISO, endISO } = this.dateRangePicker.getDates();
      this.debugLog('📅 Date range selected', { startISO, endISO });
      this.exportPeriod = { startISO, endISO };
      // RFC-0223: a full load always invalidates the per-device series cache
      // and the Períodos filter, even if the period/mode happens to be
      // unchanged — "Carregar" is an explicit refresh action.
      this.deviceSeriesCache = null;
      this.sectionModelCache = null;
      this.excludedDays = new Set();
      this.excludedHours = new Set();

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

      // RFC-0223: fetch the per-device day/hour series before the first paint
      // when a sectioned mode is already active, so loadData() never flashes
      // a "0 dias / dados incompletos" state for a mode the operator already
      // had selected before clicking "Carregar".
      await this.ensureDeviceSeriesForCurrentMode();
      this.resetCollapsedSectionsIfEpochChanged();

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
      // RFC-0223 AC25: in 1d/1h, a value sort orders DEVICE SECTIONS by their
      // effective (section-model) total, not the raw Consolidado consumption
      // field — day/hour rows within a section stay chronological regardless.
      if (this.sortField === 'consumption' && this.reportMode !== 'consolidado') {
        const aVal = this.getEffectiveDeviceTotal(a) ?? 0;
        const bVal = this.getEffectiveDeviceTotal(b) ?? 0;
        return this.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

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
    const totalConsumption = this.calculateTotalConsumption();
    const storeCount = Math.max(1, this.data.length);
    const isTemperature = (this.params.domain || 'energy') === 'temperature';

    // RFC-0223: routes through getEffectiveDeviceTotal so 1d/1h KPIs reflect
    // the section model (and, from Stage 5 on, the Périodos filter) instead of
    // the raw Consolidado `row.consumption` — a no-op for 'consolidado' itself,
    // since getEffectiveDeviceTotal returns row.consumption unchanged there.
    const withTotals = this.data.map((row) => ({ row, value: this.getEffectiveDeviceTotal(row) }));

    const maxEntry = withTotals.reduce(
      (best: { row: StoreReading; value: number | null } | null, e) =>
        e.value != null && (!best || best.value == null || e.value > best.value) ? e : best,
      null
    );
    const minEntry = withTotals
      .filter((e) => e.value != null && e.value > 0)
      .reduce(
        (best: { row: StoreReading; value: number | null } | null, e) =>
          !best || (best.value != null && e.value! < best.value) ? e : best,
        null
      );
    const zeroCount = withTotals.filter((e) => (e.value ?? 0) <= 0).length;

    const kpis: Array<{ value: string; label: string; sub?: string }> = [
      { value: String(this.data.length), label: 'Dispositivos' },
      { value: fmtPt(totalConsumption), label: this.domainConfig.totalLabel },
    ];
    // RFC-0223: in 1d/1h, calculateTotalConsumption() for temperature is
    // ALREADY a flat mean (not a sum — see its own doc comment), so dividing it
    // again by storeCount would silently shrink it into a meaningless number.
    // "Média por Dispositivo" only makes sense when totalConsumption is a sum
    // (Consolidado, and energy/water always), so it's omitted in that one
    // combination rather than computed wrong.
    if (!(isTemperature && this.reportMode !== 'consolidado')) {
      kpis.push({ value: fmtPt(totalConsumption / storeCount), label: 'Média por Dispositivo' });
    }
    kpis.push(
      {
        value: maxEntry?.value != null ? fmtPt(maxEntry.value) : '—',
        label: `Máximo (${this.domainConfig.unit})`,
        ...(maxEntry?.row.name ? { sub: maxEntry.row.name } : {}),
      },
      {
        value: minEntry?.value != null ? fmtPt(minEntry.value) : '—',
        label: `Mínimo (${this.domainConfig.unit})`,
        ...(minEntry?.row.name ? { sub: minEntry.row.name } : {}),
      }
    );
    if (!isTemperature) kpis.push({ value: String(zeroCount), label: 'Sem Consumo' });
    return kpis;
  }

  private renderTable(): void {
    const container = document.getElementById('table-container');
    if (!container) return;

    this.updateSectionToolbarVisibility();

    // RFC-0223: Diário/Horário bypass the flat/grouped Consolidado path
    // entirely and render collapsible per-device sections instead. Consolidado
    // falls through to the code below, unchanged (AC1/AC3).
    if (this.reportMode !== 'consolidado') {
      this.renderSectionedTable(container);
      return;
    }

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
    const pct = (v: number) => (grandTotal > 0 ? `${fmtPt((v / grandTotal) * 100)}%` : '—');

    const tableRows = isGrouped
      ? this.renderGroupedRows(paginatedData, grandTotal)
      : paginatedData
          .map(
            (row) => `
          <tr>
            <td data-label="Identificador" style="font-family: monospace; font-weight: bold; text-transform: uppercase;">${row.identifier}</td>
            <td data-label="Nome"><strong>${row.name}</strong></td>
            <td data-label="${this.domainConfig.label}" style="text-align: right; font-weight: bold;">${fmtPt(row.consumption)}</td>
            <td data-label="%" style="text-align: right; color: var(--myio-text-muted);">${pct(row.consumption)}</td>
          </tr>
        `
          )
          .join('');

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
            <tr>
              <th style="cursor: pointer; width: 22%;" data-sort="identifier">
                Identificador
                <span style="margin-left: 4px; opacity: ${this.getSortOpacity('identifier')};">${this.getSortIcon('identifier')}</span>
              </th>
              <th style="cursor: pointer; width: 40%;" data-sort="name">
                Nome
                <span style="margin-left: 4px; opacity: ${this.getSortOpacity('name')};">${this.getSortIcon('name')}</span>
              </th>
              <th style="cursor: pointer; text-align: right; width: 24%;" data-sort="consumption">
                ${this.domainConfig.label}
                <span style="margin-left: 4px; opacity: ${this.getSortOpacity('consumption')};">${this.getSortIcon('consumption')}</span>
              </th>
              <th style="text-align: right; width: 14%;">%</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    `;

    this.setupTableSorting();
    this.updateParticipationChart();
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

    const items = this.getFilteredData().map((row) => ({
      id: row.id || this.generateStoreId(row.identifier),
      label: row.name,
      value: this.getEffectiveDeviceTotal(row) ?? 0,
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

  // ===== RFC-0223: Diário/Horário sectioned grid ============================

  // Above this many devices, 1d/1h sections open COLLAPSED by default (AC6) so
  // a many-device customer doesn't face a wall of expanded rows on first open.
  private static readonly DEFAULT_COLLAPSE_DEVICE_THRESHOLD = 25;

  // Sum for energy/water, null-aware mean for temperature. Missing leaves
  // (null) are excluded entirely; an all-missing input still resolves to 0
  // here — callers needing temperature's "no reading at all" -> "—" rule use
  // aggregateOrNull instead (this 0-fallback would otherwise read as a
  // fabricated 0°C average).
  private aggregate(values: Array<number | null>): number {
    const domain = this.params.domain || 'energy';
    const present = values.filter((v): v is number => v != null);
    if (!present.length) return 0;
    return domain === 'temperature'
      ? present.reduce((s, v) => s + v, 0) / present.length
      : present.reduce((s, v) => s + v, 0);
  }

  // Domain-aware wrapper: energy/water still resolve an all-missing input to a
  // real 0; temperature resolves to null ("—") instead of aggregate()'s
  // unconditional 0-fallback, per the RFC's missing-bucket materialization rule.
  private aggregateOrNull(values: Array<number | null>): number | null {
    const isTemperature = (this.params.domain || 'energy') === 'temperature';
    if (isTemperature && values.every((v) => v == null)) return null;
    return this.aggregate(values);
  }

  // A day/device/group's leaf values for aggregation: hour values when hours
  // exist (for energy/water sum(hours)===sum(days) by associativity; for
  // temperature this is the REQUIRED flat mean over all included hours, not a
  // mean-of-day-means — AC18), else the day values themselves (1d mode, where
  // days ARE the leaves).
  private flattenLeafValues(days: ReportSectionDayNode[]): Array<number | null> {
    const included = days.filter((d) => !d.excluded);
    const hasHours = included.some((d) => d.hours);
    if (hasHours) {
      return included.flatMap((d) => (d.hours || []).filter((h) => !h.excluded).map((h) => h.value));
    }
    return included.map((d) => d.value);
  }

  // A missing raw bucket (bucketByDay's `null` = "no point found") materializes
  // per domain: energy/water -> 0 (a zero reading is meaningful, keeps the
  // time axis continuous); temperature -> stays null ("—"), excluded from the mean.
  private materializeMissing(value: number | null): number | null {
    if (value != null) return value;
    return (this.params.domain || 'energy') === 'temperature' ? null : 0;
  }

  // Buckets one device's raw points into every day of the period (continuous —
  // a day with no matching point still gets an entry, materialized per-domain
  // by the caller). 1d: one point per day already. 1h: points are grouped into
  // per-day hour maps, and each day's own value is the aggregate of its hours.
  private bucketByDay(
    points: Array<{ timestamp: number; value: number }>,
    days: string[],
    granularity: '1d' | '1h'
  ): Map<string, { value: number | null; hours?: Map<string, number | null> }> {
    const tz = this.timezone;
    const result = new Map<string, { value: number | null; hours?: Map<string, number | null> }>();
    for (const day of days) {
      result.set(day, { value: null, hours: granularity === '1h' ? new Map() : undefined });
    }
    if (granularity === '1d') {
      for (const p of points) {
        const bucket = result.get(toDayKey(p.timestamp, tz));
        if (bucket) bucket.value = p.value;
      }
    } else {
      // RFC-0223 review (L4): accumulate ALL readings per hour key first,
      // rather than overwriting on `.set()` — on a DST fall-back day two
      // distinct real UTC instants map onto the SAME local hour key (e.g.
      // "...T01"), and both must contribute to that hour's value (aggregate()
      // sums for energy, means for temperature) instead of the second
      // reading silently discarding the first.
      const rawHoursByDay = new Map<string, Map<string, number[]>>();
      for (const p of points) {
        const day = toDayKey(p.timestamp, tz);
        if (!result.has(day)) continue;
        const hourKey = toHourKey(p.timestamp, tz);
        let rawHours = rawHoursByDay.get(day);
        if (!rawHours) rawHoursByDay.set(day, (rawHours = new Map()));
        const list = rawHours.get(hourKey) || [];
        list.push(p.value);
        rawHours.set(hourKey, list);
      }
      for (const [day, bucket] of result) {
        const rawHours = rawHoursByDay.get(day);
        if (rawHours) {
          for (const [hourKey, values] of rawHours) bucket.hours!.set(hourKey, this.aggregate(values));
        }
        bucket.value = this.aggregateOrNull(Array.from(bucket.hours!.values()));
      }
    }
    return result;
  }

  // Stable collapsedSections/model-lookup key for a device — ingestionId when
  // present, else the display identifier (still unique within one report).
  private sectionDeviceKey(row: StoreReading): string {
    return row.id || row.identifier;
  }

  // Collapse-set keys for group/device sections — URI-encoded so a label or
  // identifier containing the data-ancestors separator (a literal space,
  // e.g. group label "Área Comum") can never split into more than one token
  // when applySectionVisibility parses `data-ancestors` back with .split(' ').
  // encodeURIComponent is the identity function for plain alphanumeric
  // strings, so existing single-word labels/ids are unaffected.
  private sectionGroupKey(groupLabel: string): string {
    return `grp:${encodeURIComponent(groupLabel)}`;
  }
  private sectionDeviceCollapseKey(row: StoreReading): string {
    return `dev:${encodeURIComponent(this.sectionDeviceKey(row))}`;
  }

  // The single pure tree builder every 1d/1h render/KPI/chart/export path
  // reads from — directly unit-testable via (modal as any).buildReportSectionModel().
  private buildReportSectionModel(): ReportSectionModel {
    const startISO = this.exportPeriod?.startISO;
    const endISO = this.exportPeriod?.endISO;
    const periodDays =
      startISO && endISO ? rangeDaysInclusive(startISO.slice(0, 10), endISO.slice(0, 10)) : [];
    const cache = this.deviceSeriesCache;
    const isTemperature = (this.params.domain || 'energy') === 'temperature';

    const buildDayNode = (
      day: string,
      rawValue: number | null,
      hours?: Array<{ key: string; value: number | null }>
    ): ReportSectionDayNode => {
      const excluded = this.excludedDays.has(day);
      let hourNodes: ReportSectionHourNode[] | undefined;
      let value = this.materializeMissing(rawValue);
      if (hours) {
        hourNodes = hours.map((h) => ({
          key: h.key,
          label: `${h.key.slice(-2)}:00`,
          value: this.materializeMissing(h.value),
          excluded: this.excludedHours.has(h.key),
        }));
        value = this.aggregateOrNull(hourNodes.filter((h) => !h.excluded).map((h) => h.value));
      }
      return { key: day, label: `${day.slice(8, 10)}/${day.slice(5, 7)}`, value, hours: hourNodes, excluded };
    };

    const buildDevice = (row: StoreReading): ReportSectionDeviceNode => {
      const coverage: 'ok' | 'partial' | 'failed' = row.id
        ? cache?.coverage.get(row.id) || 'failed'
        : 'failed';
      const points = row.id ? cache?.raw.get(row.id) : undefined;

      if (coverage === 'failed' || !points) {
        return { row, days: [], total: null, dayCount: 0, coverage: 'failed' };
      }
      if (!points.length) {
        // AC16: genuinely no readings — 0 dias, zero/dash total, no error.
        return { row, days: [], total: isTemperature ? null : 0, dayCount: 0, coverage: 'ok' };
      }

      const buckets = this.bucketByDay(points, periodDays, cache!.granularity);
      const days = periodDays.map((day) => {
        const bucket = buckets.get(day)!;
        const hours = bucket.hours
          ? Array.from(bucket.hours.entries()).map(([key, value]) => ({ key, value }))
          : undefined;
        return buildDayNode(day, bucket.value, hours);
      });

      const total = this.aggregateOrNull(this.flattenLeafValues(days));
      return { row, days, total, dayCount: periodDays.length, coverage: 'ok' };
    };

    // RFC-0182: group by groupLabel, preserving first-occurrence order — same
    // rule as the existing renderGroupedRows(), so 1d/1h sections nest inside
    // the same groups the Consolidado view already shows.
    const groupOrder: string[] = [];
    const byGroup = new Map<string, StoreReading[]>();
    for (const row of this.data) {
      const g = row.groupLabel || '—';
      if (!byGroup.has(g)) {
        byGroup.set(g, []);
        groupOrder.push(g);
      }
      byGroup.get(g)!.push(row);
    }

    const groups: ReportSectionGroupNode[] = groupOrder.map((groupLabel) => {
      const devices = byGroup.get(groupLabel)!.map(buildDevice);
      const total = this.aggregateOrNull(devices.flatMap((d) => this.flattenLeafValues(d.days)));
      return { groupLabel, devices, total };
    });

    return { groups };
  }

  // Memoized accessor — buildReportSectionModel() is O(devices × days × hours);
  // this avoids rebuilding it once per row inside computeKpis/updateParticipationChart loops.
  private getReportSectionModel(): ReportSectionModel {
    const key = [
      this.exportPeriod?.startISO,
      this.exportPeriod?.endISO,
      this.reportMode,
      this.deviceSeriesCache?.key,
      Array.from(this.excludedDays).sort().join(','),
      Array.from(this.excludedHours).sort().join(','),
      this.data.length,
    ].join('|');
    if (this.sectionModelCache?.key === key) return this.sectionModelCache.model;
    const model = this.buildReportSectionModel();
    this.sectionModelCache = { key, model };
    return model;
  }

  // Single dispatch point: 'consolidado' is byte-for-byte row.consumption;
  // 1d/1h reads the section model's device total instead, so every consumer
  // (KPIs, chart, sort, PDF/CSV builders) has only ONE place to change when
  // the Períodos filter (Stage 5) starts excluding days/hours.
  private getEffectiveDeviceTotal(row: StoreReading): number | null {
    if (this.reportMode === 'consolidado') return row.consumption;
    const device = this.getReportSectionModel()
      .groups.flatMap((g) => g.devices)
      .find((d) => d.row === row);
    return device ? device.total : row.consumption;
  }

  private computeDefaultCollapsedSections(model: ReportSectionModel): Set<string> {
    const collapsed = new Set<string>();
    const totalDevices = model.groups.reduce((n, g) => n + g.devices.length, 0);
    if (totalDevices > AllReportModal.DEFAULT_COLLAPSE_DEVICE_THRESHOLD) {
      for (const g of model.groups) {
        for (const d of g.devices) collapsed.add(this.sectionDeviceCollapseKey(d.row));
      }
    }
    return collapsed;
  }

  // AC21: reset collapse state to the AC6 defaults on a fresh load or a
  // reportMode change (period+mode epoch mismatch); a Períodos filter apply
  // (Stage 5) re-renders WITHOUT calling this, so carets persist across it.
  private resetCollapsedSectionsIfEpochChanged(): void {
    const epoch = `${this.exportPeriod?.startISO || ''}|${this.exportPeriod?.endISO || ''}|${this.reportMode}`;
    if (this.collapsedSectionsEpoch === epoch) return;
    this.collapsedSectionsEpoch = epoch;
    this.collapsedSections =
      this.reportMode === 'consolidado' ? new Set() : this.computeDefaultCollapsedSections(this.getReportSectionModel());
  }

  // Orchestrates the per-device series fetch for whatever mode is currently
  // active — called from loadData() (full load) and the mode-selector's
  // onChange (mode switch); exportHourlyCSV/exportCSV call ensureDeviceSeries
  // directly since they already have their own error handling/UI state.
  private async ensureDeviceSeriesForCurrentMode(): Promise<void> {
    if (this.reportMode === 'consolidado' || !this.data.length) return;
    try {
      await this.ensureDeviceSeries(this.data, this.reportMode);
      this.sectionModelCache = null;
    } catch (err) {
      this.debugLog('❌ Error fetching device series for sectioned report', err);
      this.showError('Erro ao buscar séries por dispositivo para o relatório seccionado. Tente novamente.');
    }
  }

  // Shows/hides the RFC-0223 toolbar controls. The Períodos button stays
  // hidden until Stage 5 gives it a click handler — a visible-but-inert button
  // would be a dead end for the operator.
  private updateSectionToolbarVisibility(): void {
    const sectioned = this.reportMode !== 'consolidado';
    const collapseBtn = document.getElementById('collapse-all-btn') as HTMLButtonElement | null;
    const periodsBtn = document.getElementById('periods-filter-btn') as HTMLButtonElement | null;
    if (collapseBtn) collapseBtn.style.display = sectioned ? '' : 'none';
    if (periodsBtn) periodsBtn.style.display = 'none';
    if (sectioned) this.updateCollapseAllButtonLabel();
  }

  private updateCollapseAllButtonLabel(): void {
    const btn = document.getElementById('collapse-all-btn') as HTMLButtonElement | null;
    if (!btn) return;
    btn.textContent = this.collapsedSections.size > 0 ? 'Expandir tudo' : 'Recolher tudo';
  }

  // Pure DOM show/hide — a caret click NEVER re-invokes renderTable()/renderSectionedRows().
  // A row is hidden if ANY of its ancestor section keys are collapsed; a header
  // row's OWN key is never in its own ancestor list, so collapsing a section
  // never hides its own header, only its descendants.
  private applySectionVisibility(container: HTMLElement): void {
    container.querySelectorAll<HTMLElement>('[data-ancestors]').forEach((row) => {
      const ancestors = (row.dataset.ancestors || '').split(' ').filter(Boolean);
      row.style.display = ancestors.some((k) => this.collapsedSections.has(k)) ? 'none' : '';
    });
    container.querySelectorAll<HTMLElement>('[data-section-toggle]').forEach((header) => {
      const key = header.dataset.sectionToggle!;
      const collapsed = this.collapsedSections.has(key);
      header.setAttribute('aria-expanded', String(!collapsed));
      const caret = header.querySelector('.rp-section-caret');
      if (caret) caret.textContent = collapsed ? '▶' : '▼';
    });
  }

  private toggleSection(key: string): void {
    if (this.collapsedSections.has(key)) this.collapsedSections.delete(key);
    else this.collapsedSections.add(key);
    const container = document.getElementById('table-container');
    if (container) this.applySectionVisibility(container);
    this.updateCollapseAllButtonLabel();
  }

  private collapseAllSections(): void {
    const model = this.getReportSectionModel();
    for (const g of model.groups) {
      this.collapsedSections.add(this.sectionGroupKey(g.groupLabel));
      for (const d of g.devices) this.collapsedSections.add(this.sectionDeviceCollapseKey(d.row));
    }
    const container = document.getElementById('table-container');
    if (container) this.applySectionVisibility(container);
    this.updateCollapseAllButtonLabel();
  }

  private expandAllSections(): void {
    this.collapsedSections.clear();
    const container = document.getElementById('table-container');
    if (container) this.applySectionVisibility(container);
    this.updateCollapseAllButtonLabel();
  }

  // Event delegation on the (stable, never-replaced) #table-container element —
  // a `data-bound`-style guard prevents double-binding across re-renders, since
  // only its innerHTML (not the element itself) is replaced on each render.
  private setupSectionToggling(container: HTMLElement): void {
    if (container.dataset.sectionTogglingBound === 'true') return;
    container.dataset.sectionTogglingBound = 'true';

    const activate = (target: EventTarget | null): void => {
      const header = (target as HTMLElement | null)?.closest<HTMLElement>('[data-section-toggle]');
      if (!header) return;
      this.toggleSection(header.dataset.sectionToggle!);
    };
    container.addEventListener('click', (e) => activate(e.target));
    container.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const header = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-section-toggle]');
      if (!header) return;
      e.preventDefault();
      activate(e.target);
    });
  }

  // Renders the group -> device -> day row tree. Day rows carry NO further
  // collapse in 1d/1h yet (Stage 4 adds the day -> hour second level for 1h);
  // for now a 1h day row simply shows its (already hour-aggregated) total,
  // matching 1d's day row exactly.
  private renderSectionedRows(model: ReportSectionModel): string {
    const visibleIds = new Set(this.getFilteredData().map((r) => this.sectionDeviceKey(r)));
    const isGrouped = this.getFilteredData().some((r) => r.groupLabel);
    const fmtValue = (v: number | null) => (v == null ? '—' : fmtPt(v));
    const pctOfDevice = (v: number | null, deviceTotal: number | null) =>
      v != null && deviceTotal != null && deviceTotal > 0 ? `${fmtPt((v / deviceTotal) * 100)}%` : '—';

    let html = '';
    for (const group of model.groups) {
      const visibleDevices = group.devices.filter((d) => visibleIds.has(this.sectionDeviceKey(d.row)));
      if (!visibleDevices.length) continue;

      const groupKey = this.sectionGroupKey(group.groupLabel);
      if (isGrouped) {
        // RFC-0223 review (M2): recomputed from visibleDevices, not
        // group.total (the whole group's total regardless of the device
        // filter) — so the header always reconciles with the device
        // sections actually rendered beneath it when Filtros & Ordenação /
        // search narrows what's visible.
        const visibleGroupTotal = this.aggregateOrNull(
          visibleDevices.flatMap((d) => this.flattenLeafValues(d.days))
        );
        html += renderCollapsibleSectionHeader({
          sectionKey: groupKey,
          ancestorKeys: [],
          level: 0,
          title: group.groupLabel,
          meta: `${visibleDevices.length} dispositivo${visibleDevices.length === 1 ? '' : 's'}`,
          totalLabel: `${fmtValue(visibleGroupTotal)} ${this.domainConfig.unit}`,
          collapsed: this.collapsedSections.has(groupKey),
          colSpan: 3,
        });
      }
      const groupAncestors = isGrouped ? [groupKey] : [];

      for (const device of visibleDevices) {
        const deviceKey = this.sectionDeviceCollapseKey(device.row);
        html += renderCollapsibleSectionHeader({
          sectionKey: deviceKey,
          ancestorKeys: groupAncestors,
          level: 1,
          title: `${device.row.name} (${device.row.identifier})`,
          meta: `${device.dayCount} dia${device.dayCount === 1 ? '' : 's'}`,
          totalLabel: `${fmtValue(device.total)} ${this.domainConfig.unit}`,
          collapsed: this.collapsedSections.has(deviceKey),
          colSpan: 3,
          incomplete: device.coverage === 'failed',
        });

        const dayAncestors = [...groupAncestors, deviceKey];
        for (const day of device.days) {
          html += renderCollapsibleLeafRow({
            ancestorKeys: dayAncestors,
            level: 2,
            cells: [
              `<td data-label="Dia">${escapeHtml(day.label)}</td>`,
              `<td data-label="${escapeHtml(this.domainConfig.label)}" style="text-align:right;">${fmtValue(day.value)}</td>`,
              `<td data-label="%" style="text-align:right;color:var(--myio-text-muted);">${pctOfDevice(day.value, device.total)}</td>`,
            ],
          });
        }
      }
    }
    return html;
  }

  private renderSectionedTable(container: HTMLElement): void {
    injectCollapsibleSectionStyles();
    const model = this.getReportSectionModel();
    const visibleIds = new Set(this.getFilteredData().map((r) => this.sectionDeviceKey(r)));
    const anyVisible = model.groups.some((g) => g.devices.some((d) => visibleIds.has(this.sectionDeviceKey(d.row))));

    if (!anyVisible) {
      // AC24: name which filter is hiding rows instead of a generic empty state.
      const deviceFiltered = this.selectedStoreIds.size > 0 && this.selectedStoreIds.size < this.data.length;
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--myio-text-muted);">
          ${
            this.searchFilter
              ? 'Nenhum dispositivo encontrado com o filtro aplicado.'
              : deviceFiltered
                ? 'Nenhum dispositivo — ajuste Filtros & Ordenação.'
                : 'Nenhum dado encontrado.'
          }
        </div>
      `;
      this.updateParticipationChart();
      return;
    }

    const rowsHtml = this.renderSectionedRows(model);
    container.innerHTML = `
      <div style="max-height: 500px; overflow-y: auto; border: 1px solid var(--myio-border); border-radius: 6px;">
        <table class="myio-table myio-table-mobile" style="table-layout: fixed; width: 100%;">
          <thead style="position: sticky; top: 0; background: var(--myio-bg); z-index: 1;">
            <tr>
              <th style="width: 62%;">Dispositivo / Dia</th>
              <th style="text-align: right; width: 24%;">${this.domainConfig.label}</th>
              <th style="text-align: right; width: 14%;">%</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;

    this.applySectionVisibility(container);
    this.setupSectionToggling(container);
    this.updateParticipationChart();
  }

  // ===== end RFC-0223 sectioned grid =========================================

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

    const pct = (v: number) => (grandTotal > 0 ? `${fmtPt((v / grandTotal) * 100)}%` : '—');

    return groupOrder
      .map((groupLabel) => {
        const items = byGroup.get(groupLabel)!;
        const groupTotal = items.reduce((s, r) => s + r.consumption, 0);

        const header = `
        <tr class="rp-group-header">
          <td colspan="4">
            ${groupLabel}
            <span class="rp-group-total">${items.length} dispositivos · ${fmtPt(groupTotal)} ${this.domainConfig.unit}</span>
          </td>
        </tr>`;

        const dataRows = items
          .map(
            (row) => `
        <tr>
          <td data-label="Identificador" style="font-family: monospace; font-weight: bold; text-transform: uppercase;">${row.identifier}</td>
          <td data-label="Nome"><strong>${row.name}</strong></td>
          <td data-label="${this.domainConfig.label}" style="text-align: right; font-weight: bold;">${fmtPt(row.consumption)}</td>
          <td data-label="%" style="text-align: right; color: var(--myio-text-muted);">${pct(row.consumption)}</td>
        </tr>`
          )
          .join('');

        return header + dataRows;
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
    if (this.reportMode === 'consolidado') {
      return this.data.reduce((sum, row) => sum + row.consumption, 0);
    }
    // RFC-0223: pooled flat aggregate over every included leaf bucket across
    // ALL devices — for energy/water this equals summing device totals
    // (associative); for temperature this is a TRUE flat mean unbiased by
    // per-device coverage disparities (same rationale as AC18's device-level
    // flat-mean rule, one level up).
    const allDevices = this.getReportSectionModel().groups.flatMap((g) => g.devices);
    const pooledLeafValues = allDevices.flatMap((d) => this.flattenLeafValues(d.days));
    return this.aggregate(pooledLeafValues);
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

    if (this.granularity === '1h') {
      await this.exportHourlyCSV(sortedData);
      return;
    }

    // RFC-0223 P1: the per-device × day sectioned CSV for Diário is P2 scope —
    // this stays the flat per-device CSV for Consolidado AND Diário alike, but
    // routes through getEffectiveDeviceTotal() (not raw row.consumption) so a
    // Diário + temperature export doesn't regress to all-zero rows (the
    // temperature enrichment fetch is intentionally skipped outside
    // 'consolidado' — see fetchCustomerTotals). A no-op for 'consolidado'.
    const csvData = [
      // Header row only
      ['Identificador', 'Nome', `Consumo (${this.domainConfig.unit})`],
      // Data rows
      ...sortedData.map((row) => [
        row.identifier,
        row.name,
        (this.getEffectiveDeviceTotal(row) ?? 0).toFixed(2),
      ]),
    ];

    const csvContent = toCsv(csvData);
    this.downloadCSV(csvContent, `relatorio-geral-lojas-${new Date().toISOString().split('T')[0]}.csv`);
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
      const series = await this.ensureDeviceSeries(sortedData, '1h');

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

  // Fetches (or reuses) the per-device series for the given granularity and
  // the current export period. Generalizes the old ensureHourlySeries
  // (1h-only, CSV-export-only) to also drive the on-screen sectioned grid at
  // either granularity, with per-device coverage tracking (AC19) replacing
  // the old silent swallow of a failed/empty device ("fica de fora do CSV").
  private async ensureDeviceSeries(
    rows: StoreReading[],
    granularity: '1d' | '1h'
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
    const cacheKey = `${startISO}|${endISO}|${granularity}|${idsKey}`;
    if (this.deviceSeriesCache?.key === cacheKey) return this.deviceSeriesCache.raw;

    const token = this.params.api.ingestionToken;
    const baseUrl = this.params.api.dataApiBaseUrl;
    if (!token || !baseUrl) throw new Error('API não configurada para busca por device');

    const endpoint = this.domainConfig.endpoint;
    const startTime = encodeURIComponent(startISO);
    const endTime = encodeURIComponent(endISO);
    const raw = new Map<string, Array<{ timestamp: number; value: number }>>();
    const coverage = new Map<string, 'ok' | 'partial' | 'failed'>();

    const targets = rows.filter((r) => r.id);
    const BATCH = 6;
    for (let i = 0; i < targets.length; i += BATCH) {
      await Promise.all(
        targets.slice(i, i + BATCH).map(async (row) => {
          const id = row.id!;
          try {
            const url = `${baseUrl}/telemetry/devices/${id}/${endpoint}?startTime=${startTime}&endTime=${endTime}&granularity=${granularity}&deep=0`;
            const res = await fetch(url, {
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            if (!res.ok) {
              coverage.set(id, 'failed');
              return;
            }
            const body = await res.json();
            const ent = Array.isArray(body) ? body[0] : body;
            const points = ((ent?.consumption || []) as Array<{ timestamp: unknown; value: unknown }>)
              .map((p) => ({ timestamp: new Date(p?.timestamp as string | number).getTime(), value: Number(p?.value) }))
              .filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.value));
            raw.set(id, points);
            coverage.set(id, 'ok');
          } catch {
            coverage.set(id, 'failed');
          }
        })
      );
    }

    const okCount = Array.from(coverage.values()).filter((c) => c === 'ok').length;
    this.debugLog(`[AllReportModal] ${granularity} series fetched for ${okCount}/${targets.length} devices`);

    // RFC-0223: discard a stale in-flight result if the mode changed to a
    // DIFFERENT granularity while this fetch was awaiting — never let it
    // clobber a newer mode's cache (the caller still gets its data either way).
    if (this.granularity !== granularity) return raw;

    this.deviceSeriesCache = { key: cacheKey, granularity, raw, coverage };
    return raw;
  }

  // Maps the report rows to the TelemetryDevice shape consumed by the shared
  // TELEMETRY grid exporters (only labelOrName/name/deviceIdentifier/val/perc are read).
  private buildExportDevices(): TelemetryDevice[] {
    // RFC-0223: routes through getEffectiveDeviceTotal so XLS export (which has
    // no dedicated sectioned builder — only the grid/PDF/CSV do) still reports
    // correct 1d/1h totals instead of the raw (possibly stale/zeroed, see
    // fetchCustomerTotals' temperature skip) Consolidado `row.consumption`. A
    // no-op for 'consolidado' itself.
    const withTotals = this.data.map((r) => ({ row: r, val: this.getEffectiveDeviceTotal(r) ?? 0 }));
    const sorted = [...withTotals].sort((a, b) => b.val - a.val);
    const total = sorted.reduce((s, e) => s + e.val, 0);
    return sorted.map((e) => ({
      labelOrName: e.row.name,
      name: e.row.name,
      deviceIdentifier: e.row.identifier,
      val: e.val,
      perc: total > 0 ? (e.val / total) * 100 : 0,
    })) as unknown as TelemetryDevice[];
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
    const chartImage = chartPng ? { ...chartPng, title: 'Participação por Dispositivo' } : null;

    // RFC-0223 P1: PDF export stays on the shared exportGridPdf for every mode
    // (byte-for-byte for Consolidado, AC1/AC3). Diário's per-device × day
    // sectioned PDF is P2 scope — buildExportDevices() already routes through
    // getEffectiveDeviceTotal() so the numbers here are correct for Diário
    // too, just not yet broken down by day (that lands with the P2 PR).
    exportGridPdf(
      this.buildExportDevices(),
      this.resolveTitle(),
      this.domainConfig.unit,
      this.exportPeriod,
      null,
      {
        accentColor: this.resolveAccentHex(),
        kpis: this.computeKpis(),
        chartImage,
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
      { accentColor: this.resolveAccentHex() },
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
    // RFC-0223: skipped outside 'consolidado' — ensureDeviceSeries() already
    // fetches this same per-device endpoint for 1d/1h sections, and
    // getEffectiveDeviceTotal() reads from that single source of truth
    // instead. Doing both would double the network cost for temperature
    // customers and risk the two fetches disagreeing at the margins (AC18).
    if ((this.params.domain || 'energy') === 'temperature' && this.reportMode === 'consolidado') {
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
    const tempRows = rows.filter((d) => String(d?.deviceType || '').toLowerCase() === 'temperature');
    if (!tempRows.length) return;

    const gran = this.granularity === '1h' ? '1h' : '1d';
    const startTime = encodeURIComponent(startISO);
    const endTime = encodeURIComponent(endISO);
    const BATCH = 6;

    for (let i = 0; i < tempRows.length; i += BATCH) {
      await Promise.all(
        tempRows.slice(i, i + BATCH).map(async (dev) => {
          try {
            const url = `${baseUrl}/telemetry/devices/${dev.id}/temperature?startTime=${startTime}&endTime=${endTime}&granularity=${gran}&deep=0`;
            const res = await fetch(url, {
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            if (!res.ok) return;
            const body = await res.json();
            const ent = Array.isArray(body) ? body[0] : body;
            const values = ((ent?.consumption || []) as Array<{ value: unknown }>)
              .map((p) => Number(p?.value))
              .filter((v) => Number.isFinite(v));
            if (values.length) {
              dev.total_value = values.reduce((s, v) => s + v, 0) / values.length;
            }
          } catch {
            /* mantém o 0 original para este sensor */
          }
        })
      );
    }
    this.debugLog(`[AllReportModal] ED-996: temperaturas médias aplicadas a ${tempRows.length} sensores`);
  }

  // Re-map the cached API response under the current exclusion flag and refresh the UI.
  // No-op until data has been loaded at least once.
  private async remapAndRender(): Promise<void> {
    if (!this.lastApiResponse) return;
    this.data = this.mapCustomerTotalsResponse(this.lastApiResponse);
    this.selectedStoreIds = new Set(this.data.map((s) => this.generateStoreId(s.identifier)));
    this.currentPage = 1;
    this.sectionModelCache = null;
    if (this.reportMode !== 'consolidado') {
      // RFC-0223: the exclusion toggle changes the device set, which changes
      // deviceSeriesCache's idsKey — force a refetch rather than serving a
      // cache keyed to the previous (pre-toggle) device list.
      this.deviceSeriesCache = null;
      await this.ensureDeviceSeriesForCurrentMode();
      this.resetCollapsedSectionsIfEpochChanged();
    }
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
      return apiArray.map((item) => ({
        identifier: item.assetName || this.resolveStoreIdentifierFromApi(item) || item.id || '',
        name: item.name || item.assetName || item.id || '',
        consumption: this.pickConsumption(item),
        ...(item.id ? { id: String(item.id) } : {}),
      }));
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

      const result: StoreReading = {
        identifier: meta?.identifier || apiItem.name || apiId,
        name:       meta?.label      || apiItem.name || apiId,
        consumption,
        id: apiId,
        ...(meta?.groupLabel ? { groupLabel: meta.groupLabel } : {}),
      };

      totalMappedConsumption += consumption;
      rows.push(result);
    }

    this.debugLog('[AllReportModal] API-driven filter', {
      matched: rows.length,
      discarded: apiArray.length - rows.length,
      totalConsumption: totalMappedConsumption,
    });

    return rows;
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
