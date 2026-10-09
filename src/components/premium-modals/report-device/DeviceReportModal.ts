// report-device/DeviceReportModal.ts
import { createModal } from '../internal/ModalPremiumShell';
import { toISOWithOffset, rangeDaysInclusive } from '../internal/engines/DateEngine';
import { toCsv } from '../internal/engines/CsvExporter';
import { fmtPt } from '../internal/engines/NumberFmt';
import { AuthClient } from '../internal/engines/AuthClient';
import { attach as attachDateRangePicker, DateRangeControl, DateRangeResult } from '../internal/DateRangePickerJQ';
import { OpenDeviceReportParams, ModalHandle, EnergyFetcher } from '../types';
import { exportGridPdf, exportGridXls } from '../../telemetry-grid-shopping/export';
import type { TelemetryDevice } from '../../telemetry-grid-shopping/types';
import { createParticipationChart } from '../../graphs';
import type { ParticipationChartInstance } from '../../graphs';
import { createGranularitySelector } from '../../granularity-selector';
import type { GranularitySelectorInstance } from '../../granularity-selector';
import { createModalFooter } from '../footer-modal';
import type { ModalFooterInstance } from '../footer-modal';

// Domain configuration
type Domain = 'energy' | 'water' | 'temperature';

interface DomainConfig {
  endpoint: string;     // API endpoint path
  unit: string;         // Display unit (kWh, m³, °C)
  label: string;        // Column label
  formatter: (value: number) => string; // Value formatter
  summaryType: 'total' | 'average'; // How to summarize the data
  summaryLabel: string; // Label for the summary (e.g., "Total", "Média")
}

const DOMAIN_CONFIG: Record<Domain, DomainConfig> = {
  energy: {
    endpoint: 'energy',
    unit: 'kWh',
    label: 'Consumo (kWh)',
    formatter: (v) => fmtPt(v),
    summaryType: 'total',
    summaryLabel: 'Total'
  },
  water: {
    endpoint: 'water',
    unit: 'm³',
    label: 'Consumo (m³)',
    formatter: (v) => fmtPt(v),
    summaryType: 'total',
    summaryLabel: 'Total'
  },
  temperature: {
    endpoint: 'temperature',
    unit: '°C',
    label: 'Temperatura (°C)',
    formatter: (v) => fmtPt(v),
    summaryType: 'average',
    summaryLabel: 'Média'
  }
};

interface DailyReading {
  date: string; // YYYY-MM-DD (1d) or full ISO timestamp (1h)
  consumption: number;
  // Temperatura: dia sem leitura → "—" na tabela e fora das médias (0 °C não é leitura)
  noData?: boolean;
}

/**
 * Params estendidos do modal. `customerName`/`theme` ainda não existem em
 * OpenDeviceReportParams (premium-modals/types.ts) — estendidos localmente
 * (campos opcionais → chamadores existentes seguem válidos). Mesmo contrato
 * do OpenAllReportParams: theme = createMyIOTheme OU mapa plano de CSS vars.
 */
export type DeviceReportModalParams = OpenDeviceReportParams & {
  /** Nome do customer/shopping exibido no footer premium da modal. */
  customerName?: string;
  /** Nome do device no ThingsBoard (entity name) — header, fonte sutil + botão copiar. */
  deviceName?: string;
  /** Temperatura: faixa ideal do cliente — sombreada no ranking de dias/horas mais quentes. */
  temperatureIdealRange?: { min: number; max: number } | null;
  /** Temperatura: offset do sensor JÁ aplicado pelo fetcher — só exibido (sutil) no header. */
  temperatureOffset?: number;
  /** Paleta do dashboard (createMyIOTheme) OU mapa plano de CSS vars (--myio-*). */
  theme?: { cssVars(): Record<string, string> } | Record<string, string>;
};

// Default energy fetcher implementation
// getGranularity is a callback so the fetcher always reads the live value at call time
const createDefaultEnergyFetcher = (params: OpenDeviceReportParams, getGranularity: () => string): EnergyFetcher => {
  return async ({ baseUrl, ingestionId, startISO, endISO }) => {
    const domain = params.domain || 'energy';
    const endpoint = DOMAIN_CONFIG[domain].endpoint;
    const url = `${baseUrl}/telemetry/devices/${ingestionId}/${endpoint}?startTime=${encodeURIComponent(startISO)}&endTime=${encodeURIComponent(endISO)}&granularity=${getGranularity()}&page=1&pageSize=1000&deep=0`;

    // Use ingestionToken for Data API endpoints (data.apps.myio-bas.com)
    // This token provides access to telemetry data from the ingestion system
    const token = params.api.ingestionToken;
    if (!token) {
      throw new Error('ingestionToken is required for Data API calls to data.apps.myio-bas.com');
    }

    const response = await fetch(url, {
      headers: {
        // Using ingestionToken for Data API endpoints (data.apps.myio-bas.com)
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  };
};

export class DeviceReportModal {
  private modal: any;
  private authClient: AuthClient;
  private energyFetcher: EnergyFetcher;
  private data: DailyReading[] = [];
  private isLoading = false;
  private eventHandlers: { [key: string]: (() => void)[] } = {};
  private dateRangePicker: DateRangeControl | null = null;
  private sortState: { key: keyof DailyReading | null; direction: 'asc' | 'desc' } = { key: null, direction: 'asc' };
  private domainConfig: DomainConfig;
  private granularity: '1d' | '1h' = '1d';
  // Granularity selector (shared component — same pill 1h|1d as EnergyModal/AllReportModal).
  private granularitySelector: GranularitySelectorInstance | null = null;
  // Footer premium: Customer · relógio · versão | Powered by MYIO | CSV.
  // O botão de export vive AQUI (removido da toolbar) — mesmo padrão do AllReportModal.
  private modalFooter: ModalFooterInstance | null = null;
  // Gráfico "Participação por Dia" (coluna direita) — criado lazy no 1º load;
  // no 1h as horas são agregadas por dia antes de alimentar o gráfico.
  private participationChart: ParticipationChartInstance | null = null;
  // Período do último load — alimenta os headers dos exports PDF/XLS.
  private exportPeriod: { startISO?: string | null; endISO?: string | null } | null = null;

  constructor(private params: DeviceReportModalParams) {
    this.authClient = new AuthClient({
      clientId: params.api.clientId,
      clientSecret: params.api.clientSecret,
      base: params.api.dataApiBaseUrl
    });

    // Set domain configuration
    const domain = params.domain || 'energy';
    this.domainConfig = DOMAIN_CONFIG[domain];

    // Initial granularity honors the (pre-existing) params.granularity field
    this.granularity = params.granularity === '1h' ? '1h' : '1d';

    // Use injected fetcher or create default with params; getter ensures live granularity
    this.energyFetcher = params.fetcher || createDefaultEnergyFetcher(params, () => this.granularity);
  }

  // Header: "Relatório - <identifier> - <label>" + nome do device (sutil, com copiar).
  // O customer já aparece no footer premium. Texto escapado — o shell usa innerHTML no título.
  private buildHeaderTitleHTML(): string {
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const base = esc(
      `Relatório - ${this.params.identifier || 'SEM IDENTIFICADOR'} - ${this.params.label || 'SEM ETIQUETA'}`
    );
    const deviceName = String(this.params.deviceName || '').trim();

    const deviceHTML = deviceName
      ? `<span class="myio-dr-devname" style="margin-left:10px;font-size:0.72em;font-weight:400;opacity:.75;display:inline-flex;align-items:center;gap:4px;vertical-align:middle;">
           ${esc(deviceName)}
           <button type="button" class="myio-dr-copy" data-copy="${esc(deviceName)}" title="Copiar nome do dispositivo"
             aria-label="Copiar nome do dispositivo"
             style="border:none;background:transparent;color:inherit;cursor:pointer;padding:0 2px;line-height:1;opacity:.9;display:inline-flex;">
             <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
           </button>
         </span>`
      : '';
    // Offset efetivamente aplicado (só temperatura, só ≠ 0) — informativo e discreto
    const off = Number(this.params.temperatureOffset) || 0;
    const offsetHTML =
      this.domainConfig.summaryType === 'average' && off !== 0
        ? `<span class="myio-dr-offset" title="Offset do sensor aplicado a todas as leituras" style="margin-left:10px;font-size:0.68em;font-weight:400;opacity:.7;vertical-align:middle;">offset ${off > 0 ? '+' : '−'}${Math.abs(off).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} °C</span>`
        : '';
    return `${base}${deviceHTML}${offsetHTML}`;
  }

  private bindCopyDeviceName(): void {
    const root: HTMLElement | undefined = this.modal?.element;
    const btn = root?.querySelector<HTMLButtonElement>('.myio-dr-copy');
    if (!btn) return;
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const text = btn.dataset.copy || '';
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Fallback p/ contextos sem Clipboard API (iframe sem permissão)
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      const prev = btn.innerHTML;
      btn.textContent = '✓';
      btn.title = 'Copiado!';
      setTimeout(() => {
        btn.innerHTML = prev;
        btn.title = 'Copiar nome do dispositivo';
      }, 1200);
    });
  }

  public show(): ModalHandle {
    this.modal = createModal({
      title: this.buildHeaderTitleHTML(),
      width: '80vw',
      height: '90vh',
      theme: this.params.ui?.theme || 'light'
    });
    this.bindCopyDeviceName();

    this.renderContent();
    this.mountFooter();
    this.modal.on('close', () => {
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

      // Cleanup granularity selector (tooltip + listeners)
      if (this.granularitySelector) {
        this.granularitySelector.destroy();
        this.granularitySelector = null;
      }

      // Cleanup participation chart (tooltips/fullscreen overlay)
      if (this.participationChart) {
        this.participationChart.destroy();
        this.participationChart = null;
      }

      this.authClient.clearCache();
      this.emit('close');
    });

    return {
      close: () => this.modal.close(),
      on: (event, handler) => this.on(event, handler)
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
            <!-- Export CSV vive no footer premium (createModalFooter) -->
          </div>
        </div>

        <div id="error-container" style="display: none; background: #ffebee; color: #c62828; padding: 12px; border-radius: 6px; margin-bottom: 16px;">
        </div>

        <style>
          /* Split layout: tabela (esquerda ~65%) + gráfico Participação por Dia
             (direita ~35%). Abaixo de 1100px o gráfico empilha em largura total. */
          .rpd-content-split { display: flex; gap: 16px; align-items: flex-start; }
          .rpd-content-split__main { flex: 1 1 65%; min-width: 0; }
          .rpd-content-split__chart { flex: 0 0 35%; min-width: 280px; }
          @media (max-width: 1100px) {
            .rpd-content-split { flex-direction: column; }
            .rpd-content-split__main,
            .rpd-content-split__chart { flex: 1 1 auto; width: 100%; min-width: 0; }
          }
        </style>
        <div class="rpd-content-split">
          <div class="rpd-content-split__main">
            <div id="summary-container" style="display: none; margin-bottom: 16px;">
            </div>

            <div id="table-container">
              <div style="text-align: center; padding: 40px; color: var(--myio-text-muted);">
                Selecione um período e clique em "Carregar" para visualizar os dados.
              </div>
            </div>
          </div>

          <div class="rpd-content-split__chart" id="participation-chart-container">
            <div id="participation-chart-placeholder" style="
              border: 1px dashed var(--myio-border, #e5e7eb); border-radius: 10px;
              padding: 32px 16px; text-align: center; font-size: 13px;
              color: var(--myio-text-muted, #6b7280);
            ">Carregue os dados para ver a participação por dia</div>
          </div>
        </div>
      </div>
    `;

    this.modal.setContent(content);
    this.applyTheme();
    this.setupEventListeners();
  }

  // Nome do customer/shopping: param explícito ou fallback no orquestrador do
  // dashboard (controllers antigos não passam o param) — mesmo padrão do AllReportModal.
  private resolveCustomerName(): string {
    if (this.params.customerName) return this.params.customerName;
    if (typeof window === 'undefined') return '';
    const win = window as {
      MyIOOrchestrator?: { customerName?: string };
      MyIOUtils?: { customerName?: string };
    };
    return win.MyIOOrchestrator?.customerName || win.MyIOUtils?.customerName || '';
  }

  // Footer premium (createModalFooter): Customer · relógio · versão da lib |
  // Powered by MYIO Platform | PDF/CSV/XLSX. Os botões de export vivem aqui —
  // recebem os MESMOS ids da antiga toolbar para que loadData continue
  // controlando disabled via getElementById (padrão AllReportModal.mountFooter).
  private mountFooter(): void {
    const lib =
      typeof window !== 'undefined'
        ? (window as { MyIOLibrary?: { version?: string } }).MyIOLibrary
        : undefined;
    this.modalFooter = createModalFooter({
      customerName: this.resolveCustomerName(),
      libVersion: { current: lib?.version },
      themeMode: this.params.ui?.theme === 'dark' ? 'dark' : 'light',
      exports: {
        pdf: {
          onClick: () => void this.exportPDF(),
          disabled: true,
          tooltipText: 'Exporta em PDF — KPIs, tabela e gráfico de participação por dia',
        },
        csv: {
          onClick: () => this.exportCSV(),
          disabled: true,
          tooltipText: 'Exporta em CSV — uma linha por dia (1d) ou por hora (1h), conforme a granularidade',
        },
        xls: {
          onClick: () => this.exportXLS(),
          disabled: true,
          tooltipText: 'Exporta a tabela em XLSX',
        },
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

  // Aplica a paleta do dashboard (params.theme — createMyIOTheme OU mapa plano de
  // CSS vars) no root da modal: os estilos internos já leem var(--myio-*).
  // Tema efetivo: param explícito OU o global do dashboard (MyIOUtils.theme) —
  // controllers antigos não passam o param, mas a MAIN expõe o global.
  private resolveTheme(): unknown {
    if (this.params.theme) return this.params.theme;
    if (typeof window === 'undefined') return undefined;
    return (window as { MyIOUtils?: { theme?: unknown } }).MyIOUtils?.theme;
  }

  private applyTheme(): void {
    const theme = this.resolveTheme() as typeof this.params.theme;
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
    const dateRangeInput = document.getElementById('date-range') as HTMLInputElement;

    loadBtn?.addEventListener('click', () => this.loadData());

    // Granularity selector — mesmo componente da EnergyModal (createGranularitySelector).
    // 1d = linhas diárias; 1h = linhas horárias (o endpoint per-device aceita granularity=1h).
    const granToggle = document.getElementById('granularity-toggle');
    if (granToggle) {
      this.granularitySelector?.destroy();
      this.granularitySelector = createGranularitySelector(granToggle, {
        settings: {
          value: this.granularity,
          // Padrão FIEL ao EnergyModal: pill "1h | 1d" (opções default do componente),
          // sem label interno (o form group acima já tem "Granularidade").
          label: '',
          themeMode: this.params.ui?.theme === 'dark' ? 'dark' : 'light',
          tooltip: {
            enabled: true,
            title: 'Granularidade',
            text: 'Em <b>Dia</b>, a tabela traz uma linha por dia; em <b>Hora</b>, uma linha por hora e o seletor de período ganha hora/minuto. KPIs e gráfico recalculam conforme a granularidade.',
          },
        },
        onChange: async (value) => {
          this.granularity = value;
          // Rebuild DateRangePicker so the time input appears only when 1h
          await this.rebuildDateRangePicker(dateRangeInput);
          this.resetAfterGranularityChange();
          // Recarrega na hora com a nova granularidade (mesmo período)
          if (this.dateRangePicker) void this.loadData();
        },
      });
    }

    // Initialize DateRangePicker with default current month range
    await this.rebuildDateRangePicker(dateRangeInput);

    // Abre já carregado com o período padrão do campo (sem exigir o clique em "Carregar")
    if (this.dateRangePicker) void this.loadData();
  }

  // Limpa dados/KPIs/gráfico após troca de granularidade — o usuário precisa
  // clicar em "Carregar" novamente (o fetch usa a granularidade viva).
  private resetAfterGranularityChange(): void {
    this.data = [];
    const tableContainer = document.getElementById('table-container');
    if (tableContainer) {
      tableContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--myio-text-muted);">
          Granularidade alterada para <strong>${this.granularity}</strong>. Clique em "Carregar" para atualizar os dados.
        </div>
      `;
    }
    const summaryContainer = document.getElementById('summary-container');
    if (summaryContainer) summaryContainer.style.display = 'none';
    this.participationChart?.updateData([]);
    this.modalFooter?.setExportDisabled('csv', true);
    this.modalFooter?.setExportDisabled('pdf', true);
    this.modalFooter?.setExportDisabled('xls', true);
  }

  /**
   * (Re)builds the DateRangePicker. Time picker only shown when granularity = '1h'.
   * Preserves the currently selected range when rebuilding after a granularity change.
   */
  private async rebuildDateRangePicker(input: HTMLInputElement): Promise<void> {
    // Keep only the date portion (YYYY-MM-DD). Times are always reset to
    // 00:00:00 / 23:59:59 on rebuild so toggling granularity deterministically
    // brings back the full-day default.
    const toYmd = (v: unknown): string | undefined => {
      if (!v) return undefined;
      if (v instanceof Date) return v.toISOString().split('T')[0];
      if (typeof v === 'string') return v.split('T')[0];
      return undefined;
    };

    let startYmd: string | undefined;
    let endYmd: string | undefined;

    if (this.dateRangePicker) {
      try {
        const current = this.dateRangePicker.getDates();
        startYmd = toYmd(current.startISO);
        endYmd = toYmd(current.endISO);
      } catch { /* fall back to defaults */ }
      this.dateRangePicker.destroy();
      this.dateRangePicker = null;
    }

    if (!startYmd) startYmd = toYmd(this.getDefaultStartDate());
    if (!endYmd) endYmd = toYmd(this.getDefaultEndDate());

    const presetStart = startYmd ? `${startYmd}T00:00:00-03:00` : undefined;
    const presetEnd = endYmd ? `${endYmd}T23:59:59-03:00` : undefined;

    try {
      this.dateRangePicker = await attachDateRangePicker(input, {
        presetStart,
        presetEnd,
        // Ciclo de rateio (dia D → dia D do mês seguinte) tem até 32 dias corridos (ex.: 15/08→15/09)
        maxRangeDays: 32,
        includeTime: this.granularity === '1h',
        timePrecision: 'minute',
        parentEl: this.modal.element,
        onApply: ({ startISO, endISO }) => {
          this.hideError();
          console.log('Date range selected:', { startISO, endISO });
        }
      });
    } catch (error) {
      // Sem fallback nativo: attach() lança quando as libs do CDN não carregam;
      // dateRangePicker fica null e o loadData avisa "Seletor de data não inicializado".
      console.warn('DateRangePicker initialization failed:', error);
    }
  }

  // Janela da consulta. No 1d a API recebe dias inteiros — os MESMOS dias que viram
  // linhas no zero-fill (rangeDaysInclusive): início 00:00:00 e fim 23:59:59. Um fim à
  // meia-noite (ex.: 15/09T00:00:00, exclusivo na API) não vira mais um dia "0,00" que
  // nem foi consultado. No 1h vale a hora escolhida.
  // Contrato do getDates(): hora LOCAL + offset (YYYY-MM-DDTHH:mm:ss±HH:MM) — os 10
  // primeiros caracteres são o dia exibido e os 6 últimos, o offset.
  private resolveQueryWindow(range: DateRangeResult): { startISO: string; endISO: string } {
    if (this.granularity === '1h' || !range.startISO || !range.endISO) return range;
    const day = (iso: string) => iso.slice(0, 10);
    const offset = (iso: string) => iso.slice(-6);
    return {
      startISO: `${day(range.startISO)}T00:00:00${offset(range.startISO)}`,
      endISO: `${day(range.endISO)}T23:59:59${offset(range.endISO)}`,
    };
  }

  private async loadData(): Promise<void> {
    if (this.isLoading) return;

    const loadBtn = document.getElementById('load-btn') as HTMLButtonElement;
    // Botões de export vivem no footer premium — mantêm os MESMOS ids da antiga toolbar.
    const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
    const pdfBtn = document.getElementById('export-pdf-btn') as HTMLButtonElement | null;
    const xlsBtn = document.getElementById('export-xls-btn') as HTMLButtonElement | null;
    const spinner = document.getElementById('load-spinner');

    // Get date range from DateRangePicker
    if (!this.dateRangePicker) {
      this.showError('Seletor de data não inicializado');
      return;
    }

    this.isLoading = true;
    loadBtn.disabled = true;
    if (exportBtn) exportBtn.disabled = true;
    if (pdfBtn) pdfBtn.disabled = true;
    if (xlsBtn) xlsBtn.disabled = true;
    spinner!.style.display = 'inline-block';

    try {
      const { startISO, endISO } = this.resolveQueryWindow(this.dateRangePicker.getDates());
      this.exportPeriod = { startISO, endISO };

      if (!startISO || !endISO) {
        this.showError('Selecione um período válido');
        return;
      }

      // Extract date parts for range generation (YYYY-MM-DD format)
      const startDate = startISO.split('T')[0];
      const endDate = endISO.split('T')[0];

      // Generate complete date range for zero-filling
      const dateRange = rangeDaysInclusive(startDate, endDate);

      // Use injected fetcher (real API or mock for testing)
      const apiResponse = await this.energyFetcher({
        baseUrl: this.params.api.dataApiBaseUrl || 'https://api.data.apps.myio-bas.com',
        ingestionId: this.params.ingestionId,
        startISO,
        endISO,
        granularity: this.granularity,
      });

      // Process API response
      this.data = this.processApiResponse(apiResponse, dateRange);
      this.renderSummary();
      this.renderTable();
      this.updateDayChart();
      if (exportBtn) exportBtn.disabled = false;
      if (pdfBtn) pdfBtn.disabled = false;
      if (xlsBtn) xlsBtn.disabled = false;

      this.emit('loaded', {
        date: { start: startDate, end: endDate },
        count: this.data.length,
        total: this.calculateTotal()
      });

    } catch (error) {
      this.showError('Erro ao carregar dados: ' + (error as Error).message);
      console.error('Error loading data:', error);
      this.emit('error', { message: (error as Error).message, context: 'loadData' });
    } finally {
      this.isLoading = false;
      loadBtn.disabled = false;
      spinner!.style.display = 'none';
    }
  }

  private processApiResponse(apiResponse: any, dateRange: string[]): DailyReading[] {
    // Handle response - expect array with data property
    const dataArray = Array.isArray(apiResponse) ? apiResponse : (apiResponse.data || []);
    const isHourly = (this.granularity) === '1h';

    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      console.warn("[DeviceReportModal] API returned empty or invalid response, zero-filling date range");
      if (isHourly) return [];
      // Temperatura: sem leitura ≠ 0 °C
      const noData = this.domainConfig.summaryType === 'average';
      return dateRange.map(date => ({ date, consumption: 0, ...(noData ? { noData: true } : {}) }));
    }

    const deviceData = dataArray[0]; // First (and likely only) device
    const consumption = deviceData.consumption || [];

    // Temperatura: dia = MÉDIA das leituras do dia (não soma); dia sem leitura = noData
    if (!isHourly && this.domainConfig.summaryType === 'average') {
      const acc: { [key: string]: { sum: number; n: number } } = {};
      consumption.forEach((item: any) => {
        if (item.timestamp && item.value != null && Number.isFinite(Number(item.value))) {
          const date = String(item.timestamp).slice(0, 10);
          const a = acc[date] || (acc[date] = { sum: 0, n: 0 });
          a.sum += Number(item.value);
          a.n += 1;
        }
      });
      return dateRange.map((date) =>
        acc[date] ? { date, consumption: acc[date].sum / acc[date].n } : { date, consumption: 0, noData: true }
      );
    }

    if (isHourly) {
      // Hourly: HORA FECHADA — a API devolve blocos sub-horários (15/30 min) mesmo pedindo
      // 1h; consolida por hora: média (temperatura) ou soma (consumo). Sem zero-fill.
      const isAvg = this.domainConfig.summaryType === 'average';
      const HOUR = 3600 * 1000;
      const byHour = new Map<number, { sum: number; n: number }>();
      consumption.forEach((item: any) => {
        if (!item.timestamp || item.value == null) return;
        const ts = new Date(item.timestamp).getTime();
        const v = Number(item.value);
        if (!Number.isFinite(ts) || !Number.isFinite(v)) return;
        const h = Math.floor(ts / HOUR) * HOUR;
        const acc = byHour.get(h) || { sum: 0, n: 0 };
        acc.sum += v;
        acc.n += 1;
        byHour.set(h, acc);
      });
      return [...byHour.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([h, { sum, n }]) => ({
          date: new Date(h).toISOString(),
          consumption: isAvg ? sum / n : sum,
        }));
    }

    // Daily: build map and zero-fill with date range
    const dailyMap: { [key: string]: number } = {};
    consumption.forEach((item: any) => {
      if (item.timestamp && item.value != null) {
        const date = item.timestamp.slice(0, 10); // Extract YYYY-MM-DD
        const value = Number(item.value);
        if (!dailyMap[date]) dailyMap[date] = 0;
        dailyMap[date] += value;
      }
    });

    return dateRange.map(date => ({
      date,
      consumption: dailyMap[date] || 0,
    }));
  }

  private generateMockData(dateRange: string[]): DailyReading[] {
    // Fallback mock data generator (kept for compatibility)
    return dateRange.map(date => ({
      date,
      consumption: Math.random() * 50 + 10 // 10-60 kWh
    }));
  }

  // ── KPIs (padrão AllReport: valor 17px / label 12px / sub 10px) ────────────
  // Variam com a granularidade:
  //   1d: Total|Média · Média por Dia · Dia Maior · Dia Menor (>0) · Dias sem Consumo
  //   1h: Total|Média · Média por Dia · Média por Hora · Hora Maior · Hora Menor (>0) · Horas sem Consumo
  // Temperatura (summaryType 'average'): Máx/Mín consideram todas as leituras e
  // os cards "sem consumo" ficam ocultos (não há semântica de consumo zero).
  private renderSummary(): void {
    const container = document.getElementById('summary-container');
    if (!container) return;

    if (!this.data.length) {
      container.style.display = 'none';
      return;
    }

    const kpiCard = (kpi: { value: string; label: string; sub?: string }) => `
        <div style="text-align: center;">
          <div style="font-size: 17px; font-weight: bold; color: var(--myio-primary);">${kpi.value}</div>
          <div style="font-size: 12px; color: var(--myio-text-muted);">${kpi.label}</div>
          ${kpi.sub ? `<div style="font-size: 10px; color: var(--myio-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${kpi.sub}">${kpi.sub}</div>` : ''}
        </div>`;

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; padding: 16px; background: var(--myio-bg); border-radius: 6px;">
        ${this.computeKpis().map(kpiCard).join('')}
      </div>
    `;
    container.style.display = 'block';
  }

  // KPIs do summary — compartilhados entre a UI (renderSummary) e o PDF export
  // (mesmo padrão do AllReportModal.computeKpis). Variam com a granularidade.
  private computeKpis(): Array<{ value: string; label: string; sub?: string }> {
    const fmt = this.domainConfig.formatter;
    const unit = this.domainConfig.unit;
    const isHourly = this.granularity === '1h';
    const isTemperature = this.domainConfig.summaryType === 'average';

    const total = this.calculateTotal();
    const rows = this.validRows;
    const summaryValue = isTemperature
      ? (rows.length > 0 ? total / rows.length : 0)
      : total;

    // Dias distintos (no 1h várias linhas caem no mesmo dia)
    const dayKeys = new Set(rows.map((r) => r.date.slice(0, 10)));
    const dayCount = Math.max(1, dayKeys.size);

    // Máximo/Mínimo por linha (dia no 1d, hora no 1h). Mínimo considera apenas
    // leituras > 0 (as zeradas já aparecem no KPI "sem consumo") — exceto
    // temperatura, onde 0 é leitura válida.
    const maxRow = rows.reduce(
      (best: DailyReading | null, r) => (!best || r.consumption > best.consumption ? r : best),
      null
    );
    const minPool = isTemperature ? rows : rows.filter((r) => r.consumption > 0);
    const minRow = minPool.reduce(
      (best: DailyReading | null, r) => (!best || r.consumption < best.consumption ? r : best),
      null
    );
    const zeroCount = this.data.filter((r) => r.consumption <= 0).length;

    const rowLabel = isHourly ? 'Hora' : 'Dia';

    const kpis: Array<{ value: string; label: string; sub?: string }> = [
      { value: `${fmt(summaryValue)} ${unit}`, label: `${this.domainConfig.summaryLabel} (${unit})` },
      { value: fmt(total / dayCount), label: `Média por Dia (${unit})` },
    ];
    if (isHourly) {
      kpis.push({ value: fmt(rows.length ? total / rows.length : 0), label: `Média por Hora (${unit})` });
    }
    kpis.push(
      {
        value: maxRow ? fmt(maxRow.consumption) : '—',
        label: `${rowLabel} com Maior ${isTemperature ? 'Temperatura' : 'Consumo'} (${unit})`,
        ...(maxRow ? { sub: this.formatDate(maxRow.date) } : {}),
      },
      {
        value: minRow ? fmt(minRow.consumption) : '—',
        label: `${rowLabel} com Menor ${isTemperature ? 'Temperatura' : 'Consumo'} (${unit})`,
        ...(minRow ? { sub: this.formatDate(minRow.date) } : {}),
      }
    );
    if (!isTemperature) {
      kpis.push({ value: String(zeroCount), label: isHourly ? 'Horas sem Consumo' : 'Dias sem Consumo' });
    } else {
      const noData = this.data.length - rows.length;
      if (noData > 0) kpis.push({ value: String(noData), label: isHourly ? 'Horas sem Leitura' : 'Dias sem Leitura' });
    }
    return kpis;
  }

  // Resolve the chart palette from the host theme: createMyIOTheme exposes
  // tones(n) — solid hex tones derived from the dashboard accent. When absent
  // (or the accent is not hex), the component falls back to the MYIO palette.
  private resolveChartPalette(count: number): string[] | undefined {
    const theme = this.resolveTheme() as { tones?: (n: number) => string[] | null } | undefined;
    if (theme && typeof theme.tones === 'function') {
      const tones = theme.tones(count);
      if (Array.isArray(tones) && tones.length) return tones;
    }
    return undefined;
  }

  // Gráfico "Participação por Dia": items = dias do período (label dd/mm).
  // No 1h as horas são agregadas por dia. Default em BARRAS — com até 31 dias a
  // pizza fica ilegível; o seletor Pizza|Barras do componente segue disponível.
  // Temperatura fica de fora: "participação no total" não tem semântica de média °C.
  // Temperatura (painel direito): ranking em barras — 1d = dias mais quentes (média do dia);
  // 1h = horas mais quentes (top 24). Escala comum + faixa ideal sombreada (padrão AllReport).
  private renderTemperatureRanking(container: HTMLElement): void {
    const isHourly = this.granularity === '1h';
    const valid = this.validRows;
    if (!valid.length) {
      container.innerHTML = `<div style="border:1px dashed var(--myio-border,#e5e7eb);border-radius:10px;padding:32px 16px;text-align:center;font-size:13px;color:var(--myio-text-muted,#6b7280);">Sem leituras no período</div>`;
      return;
    }
    const TOP_HOURS = 24;
    const ranked = [...valid].sort((a, b) => b.consumption - a.consumption);
    const shown = isHourly ? ranked.slice(0, TOP_HOURS) : ranked;
    const noData = isHourly ? [] : this.data.filter((r) => r.noData);
    const ideal = this.params.temperatureIdealRange;
    const hasIdeal = !!ideal && Number.isFinite(Number(ideal.min)) && Number.isFinite(Number(ideal.max));

    const values = shown.map((r) => r.consumption);
    const lo = Math.floor(Math.min(...values, hasIdeal ? Number(ideal!.min) : Infinity) - 1);
    const hi = Math.ceil(Math.max(...values, hasIdeal ? Number(ideal!.max) : -Infinity) + 1);
    const span = Math.max(1, hi - lo);
    const pos = (v: number) => `${(((v - lo) / span) * 100).toFixed(2)}%`;
    const band = hasIdeal
      ? `<div style="position:absolute;top:0;bottom:0;left:${pos(Number(ideal!.min))};width:calc(${pos(Number(ideal!.max))} - ${pos(Number(ideal!.min))});background:rgba(34,197,94,.15);border-left:1px dashed #22c55e;border-right:1px dashed #22c55e;"></div>`
      : '';
    const color = (v: number) =>
      hasIdeal && v > Number(ideal!.max) ? '#ef4444' : hasIdeal && v < Number(ideal!.min) ? '#3b82f6' : 'var(--myio-brand-700, #3e1a7d)';

    const line = (label: string, r: DailyReading | null) => `
      <div style="display:grid;grid-template-columns:minmax(0,40%) 1fr 48px;gap:8px;align-items:center;margin-bottom:6px;font-size:12px;">
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${label}">${label}</span>
        ${
          r
            ? `<div style="position:relative;height:12px;background:var(--myio-border,#e5e7eb);border-radius:6px;overflow:hidden;">${band}
                 <div style="position:absolute;top:2px;bottom:2px;left:0;width:${pos(r.consumption)};background:${color(r.consumption)};border-radius:4px;opacity:.85;"></div></div>`
            : `<span style="font-size:11px;color:var(--myio-text-muted,#9ca3af);">Sem leitura</span>`
        }
        <span style="text-align:right;font-variant-numeric:tabular-nums;font-weight:600;">${r ? this.domainConfig.formatter(r.consumption) : '—'}</span>
      </div>`;

    const title = isHourly
      ? `Horas mais quentes${ranked.length > TOP_HOURS ? ` (top ${TOP_HOURS})` : ''}`
      : 'Dias mais quentes (média do dia)';
    container.innerHTML = `
      <div style="border:1px solid var(--myio-border,#e5e7eb);border-radius:10px;padding:12px 14px;max-height:620px;overflow-y:auto;">
        <div style="font-weight:700;font-size:14px;margin-bottom:2px;">${title}</div>
        <div style="font-size:11px;color:var(--myio-text-muted,#6b7280);margin-bottom:10px;">
          Escala ${this.domainConfig.formatter(lo)}–${this.domainConfig.formatter(hi)} °C${
            hasIdeal
              ? ` · <span style="color:#16a34a;">faixa ideal ${this.domainConfig.formatter(Number(ideal!.min))}–${this.domainConfig.formatter(Number(ideal!.max))} °C</span>`
              : ''
          }
        </div>
        ${shown.map((r) => line(this.formatDate(r.date), r)).join('')}
        ${noData.map((r) => line(this.formatDate(r.date), null)).join('')}
      </div>`;
  }

  private updateDayChart(): void {
    const container = document.getElementById('participation-chart-container');
    if (!container) return;

    if (this.domainConfig.summaryType === 'average') {
      this.renderTemperatureRanking(container);
      return;
    }

    // Aggregate rows by day (identity in 1d; sum of hours in 1h)
    const byDay = new Map<string, number>();
    for (const row of this.data) {
      const day = row.date.slice(0, 10);
      byDay.set(day, (byDay.get(day) || 0) + row.consumption);
    }

    const items = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, value]) => {
        const [, m, d] = day.split('-');
        return { id: day, label: `${d}/${m}`, value };
      });

    if (!this.participationChart) {
      if (!items.length) return; // keep the "Carregue os dados..." placeholder
      document.getElementById('participation-chart-placeholder')?.remove();
      this.participationChart = createParticipationChart(container, {
        items,
        unit: this.domainConfig.unit,
        title: 'Participação por Dia',
        chartType: 'bars',
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

  private renderTable(): void {
    const container = document.getElementById('table-container');
    if (!container) return;

    // Helper function to get sort indicator
    const getSortIndicator = (columnKey: string) => {
      if (this.sortState.key === columnKey) {
        return this.sortState.direction === 'asc' ? '↑' : '↓';
      }
      return '↕';
    };

    container.innerHTML = `
      <div style="max-height: 400px; overflow-y: auto; border: 1px solid var(--myio-border); border-radius: 6px;">
        <table class="myio-table">
          <thead style="position: sticky; top: 0; background: var(--myio-bg); z-index: 1;">
            <tr>
              <th style="cursor: pointer;" data-sort="date">
                ${(this.granularity) === '1h' ? 'Data/Hora' : 'Data'}
                <span style="margin-left: 4px; opacity: ${this.sortState.key === 'date' ? '1' : '0.5'};">${getSortIndicator('date')}</span>
              </th>
              <th style="cursor: pointer; text-align: right;" data-sort="consumption">
                ${this.domainConfig.label}
                <span style="margin-left: 4px; opacity: ${this.sortState.key === 'consumption' ? '1' : '0.5'};">${getSortIndicator('consumption')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            ${this.data.map(row => `
              <tr>
                <td>${this.formatDate(row.date)}</td>
                <td style="text-align: right;${row.noData ? ' color: var(--myio-text-muted);' : ''}">${row.noData ? 'Sem leitura' : this.domainConfig.formatter(row.consumption)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    this.setupTableSorting();
  }

  private setupTableSorting(): void {
    const headers = document.querySelectorAll('[data-sort]');
    headers.forEach(header => {
      header.addEventListener('click', () => {
        const sortKey = header.getAttribute('data-sort') as keyof DailyReading;
        this.sortData(sortKey);
        this.renderTable();
      });
    });
  }

  private sortData(key: keyof DailyReading): void {
    // Determine sort direction
    if (this.sortState.key === key) {
      // Same column clicked, toggle direction
      this.sortState.direction = this.sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
      // New column clicked, start with ascending
      this.sortState.key = key;
      this.sortState.direction = 'asc';
    }

    // Sort the data
    this.data.sort((a, b) => {
      let comparison = 0;

      if (key === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else {
        // Sem leitura sempre no fim, independente da direção
        if (!!a.noData !== !!b.noData) return a.noData ? 1 : -1;
        comparison = a.consumption - b.consumption;
      }

      // Apply sort direction
      return this.sortState.direction === 'desc' ? -comparison : comparison;
    });
  }

  // Linhas com leitura (temperatura: dia sem leitura fica fora de totais/médias/KPIs)
  private get validRows(): DailyReading[] {
    return this.data.filter((r) => !r.noData);
  }

  private calculateTotal(): number {
    return this.validRows.reduce((sum, row) => sum + row.consumption, 0);
  }

  private formatDate(dateStr: string): string {
    if (!dateStr) return '';
    if (dateStr.includes('T')) {
      // Hourly timestamp: YYYY-MM-DDTHH:mm:ss
      const date = new Date(dateStr);
      return (
        date.toLocaleDateString('pt-BR') +
        ' ' +
        date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      );
    }
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  }

  private exportCSV(): void {
    const total = this.calculateTotal();
    const valid = this.validRows.length;
    const summaryValue = this.domainConfig.summaryType === 'average'
      ? (valid > 0 ? total / valid : 0)
      : total;
    const now = new Date();
    const timestamp = now.toLocaleDateString('pt-BR') + ' - ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const csvData = [
      ['Dispositivo/Loja', this.params.identifier || 'N/A', this.params.label || ''],
      ['DATA EMISSÃO', timestamp, ''],
      [this.domainConfig.summaryLabel, this.domainConfig.formatter(summaryValue), this.domainConfig.unit],
      [this.granularity === '1h' ? 'Data/Hora' : 'Data', this.domainConfig.label, ''],
      ...this.data.map(row => [this.formatDate(row.date), row.noData ? 'Sem leitura' : this.domainConfig.formatter(row.consumption)])
    ];

    const csvContent = toCsv(csvData);
    const granSuffix = this.granularity === '1h' ? '-1h' : '';
    this.downloadCSV(csvContent, `relatorio-${this.params.identifier || 'dispositivo'}${granSuffix}-${new Date().toISOString().split('T')[0]}.csv`);
  }

  // Accent hex da paleta do dashboard (params.theme) para os exports — cai no
  // roxo MYIO default quando não há tema configurado (padrão AllReportModal).
  private resolveAccentHex(): string | undefined {
    const theme = this.resolveTheme() as
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

  // Título dos exports — mesmo da modal (identificador + etiqueta do device).
  private resolveExportTitle(): string {
    return `Relatório - ${this.params.identifier || 'SEM IDENTIFICADOR'} - ${this.params.label || 'SEM ETIQUETA'}`;
  }

  // Mapeia as linhas do relatório (dia/hora × consumo) para o shape TelemetryDevice
  // dos exporters compartilhados do grid: labelOrName = data formatada, val = consumo,
  // perc = participação % sobre o total do período (omitido para temperatura —
  // "% de uma média °C" não tem semântica; buildRow imprime '—').
  private buildExportDevices(): TelemetryDevice[] {
    const isTemperature = this.domainConfig.summaryType === 'average';
    const total = this.calculateTotal();
    return this.data.map((row) => ({
      labelOrName: this.formatDate(row.date),
      name: this.formatDate(row.date),
      val: row.noData ? null : row.consumption,
      ...(isTemperature || total <= 0 ? {} : { perc: (row.consumption / total) * 100 }),
    })) as unknown as TelemetryDevice[];
  }

  // Opções de coluna dos exporters: relatório single-device → Data | Consumo | %
  // (Identificador redundante — o device já está no título/filename).
  private exportColumnOptions(): { nameLabel: string; hideIdentifier: boolean } {
    return {
      nameLabel: this.granularity === '1h' ? 'Data/Hora' : 'Data',
      hideIdentifier: true,
    };
  }

  // PDF export — layout premium do grid + paleta do dashboard + faixa de KPIs +
  // página dedicada com o gráfico "Participação por Dia" da modal.
  private async exportPDF(): Promise<void> {
    if (!this.data.length) return;

    const chartPng = await this.participationChart?.toPngDataUrl?.().catch(() => null);

    exportGridPdf(
      this.buildExportDevices(),
      this.resolveExportTitle(),
      this.domainConfig.unit,
      this.exportPeriod,
      this.resolveCustomerName() || null,
      {
        accentColor: this.resolveAccentHex(),
        kpis: this.computeKpis(),
        chartImage: chartPng ? { ...chartPng, title: 'Participação por Dia' } : null,
        columns: this.exportColumnOptions(),
      },
    );
  }

  // XLS export (XML Spreadsheet) — mesma tabela da UI com header no accent do dashboard.
  private exportXLS(): void {
    if (!this.data.length) return;
    exportGridXls(
      this.buildExportDevices(),
      this.resolveExportTitle(),
      this.domainConfig.unit,
      this.exportPeriod,
      this.resolveCustomerName() || null,
      {
        accentColor: this.resolveAccentHex(),
        columns: this.exportColumnOptions(),
      },
    );
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
      this.eventHandlers[event].forEach(handler => handler());
    }
  }
}
