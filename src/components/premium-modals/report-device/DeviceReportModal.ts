// report-device/DeviceReportModal.ts
import { createModal } from '../internal/ModalPremiumShell';
import { toISOWithOffset, rangeDaysInclusive } from '../internal/engines/DateEngine';
import { toCsv } from '../internal/engines/CsvExporter';
import { fmtPt } from '../internal/engines/NumberFmt';
import { AuthClient } from '../internal/engines/AuthClient';
import { attach as attachDateRangePicker, DateRangeControl } from '../internal/DateRangePickerJQ';
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

  public show(): ModalHandle {
    this.modal = createModal({
      title: `Relatório - ${this.params.identifier || 'SEM IDENTIFICADOR'} - ${this.params.label || 'SEM ETIQUETA'}`,
      width: '80vw',
      height: '90vh',
      theme: this.params.ui?.theme || 'light'
    });

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
        },
      });
    }

    // Initialize DateRangePicker with default current month range
    await this.rebuildDateRangePicker(dateRangeInput);
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
        maxRangeDays: 31,
        includeTime: this.granularity === '1h',
        timePrecision: 'minute',
        parentEl: this.modal.element,
        onApply: ({ startISO, endISO }) => {
          this.hideError();
          console.log('Date range selected:', { startISO, endISO });
        }
      });
    } catch (error) {
      console.warn('DateRangePicker initialization failed, using fallback:', error);
      // DateRangePicker will automatically fallback to native inputs
    }
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
      const { startISO, endISO } = this.dateRangePicker.getDates();
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
        endISO
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
      return dateRange.map(date => ({ date, consumption: 0 }));
    }

    const deviceData = dataArray[0]; // First (and likely only) device
    const consumption = deviceData.consumption || [];

    if (isHourly) {
      // Hourly: keep full timestamp, no zero-fill
      return consumption
        .filter((item: any) => item.timestamp && item.value != null)
        .map((item: any) => ({
          date: item.timestamp,
          consumption: Number(item.value),
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
    const summaryValue = isTemperature
      ? (this.data.length > 0 ? total / this.data.length : 0)
      : total;

    // Dias distintos (no 1h várias linhas caem no mesmo dia)
    const dayKeys = new Set(this.data.map((r) => r.date.slice(0, 10)));
    const dayCount = Math.max(1, dayKeys.size);

    // Máximo/Mínimo por linha (dia no 1d, hora no 1h). Mínimo considera apenas
    // leituras > 0 (as zeradas já aparecem no KPI "sem consumo") — exceto
    // temperatura, onde 0 é leitura válida.
    const maxRow = this.data.reduce(
      (best: DailyReading | null, r) => (!best || r.consumption > best.consumption ? r : best),
      null
    );
    const minPool = isTemperature ? this.data : this.data.filter((r) => r.consumption > 0);
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
      kpis.push({ value: fmt(total / this.data.length), label: `Média por Hora (${unit})` });
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
  private updateDayChart(): void {
    const container = document.getElementById('participation-chart-container');
    if (!container) return;

    if (this.domainConfig.summaryType === 'average') {
      const placeholder = document.getElementById('participation-chart-placeholder');
      if (placeholder) placeholder.textContent = 'Participação por dia não se aplica a temperatura';
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
                <td style="text-align: right;">${this.domainConfig.formatter(row.consumption)}</td>
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
        comparison = a.consumption - b.consumption;
      }

      // Apply sort direction
      return this.sortState.direction === 'desc' ? -comparison : comparison;
    });
  }

  private calculateTotal(): number {
    return this.data.reduce((sum, row) => sum + row.consumption, 0);
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
    const summaryValue = this.domainConfig.summaryType === 'average'
      ? (this.data.length > 0 ? total / this.data.length : 0)
      : total;
    const now = new Date();
    const timestamp = now.toLocaleDateString('pt-BR') + ' - ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const csvData = [
      ['Dispositivo/Loja', this.params.identifier || 'N/A', this.params.label || ''],
      ['DATA EMISSÃO', timestamp, ''],
      [this.domainConfig.summaryLabel, this.domainConfig.formatter(summaryValue), this.domainConfig.unit],
      [this.granularity === '1h' ? 'Data/Hora' : 'Data', this.domainConfig.label, ''],
      ...this.data.map(row => [this.formatDate(row.date), this.domainConfig.formatter(row.consumption)])
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
      val: row.consumption,
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
