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
import { InfoTooltip } from '../../../utils/InfoTooltip';
import { exportGridPdf, exportGridXls } from '../../telemetry-grid-shopping/export';
import type { TelemetryDevice } from '../../telemetry-grid-shopping/types';

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
    label: 'Consumption (kWh)',
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

  // When true, devices flagged via `exclude_groups_totals` for this group are dropped
  // from the report so its total reconciles with the dashboard KPIs. Toggleable in the UI.
  private considerExclusion = true;
  // Raw API response kept so the exclusion toggle can re-map without a new fetch.
  private lastApiResponse: any = null;
  // Search period of the last load — fed to the PDF/XLS export headers.
  private exportPeriod: { startISO?: string | null; endISO?: string | null } | null = null;
  // Cleanup for the InfoTooltip attached to the exclusion-flag info icon.
  private exclusionTooltipCleanup: (() => void) | null = null;

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

  private resolveTitle(): string {
    const domain = this.params.domain || 'energy';
    const group = this.params.group || 'lojas';

    const TITLES: Record<string, Record<string, string>> = {
      energy: {
        lojas: 'Relatório Geral - Todas as Lojas',
        entrada: 'Relatório Geral - Dispositivos de Entrada',
        area_comum: 'Relatório Geral - Equipamentos em Área Comum',
        todos: 'Relatório Geral - Todos os Dispositivos de Energia',
      },
      water: {
        lojas: 'Relatório Geral - Todas as Lojas',
        entrada: 'Relatório Geral - Dispositivos de Entrada',
        area_comum: 'Relatório Geral - Equipamentos em Área Comum',
        banheiros: 'Relatório Geral - Banheiros',
        todos: 'Relatório Geral - Todos os Dispositivos de Água',
      },
      temperature: {
        climatizavel: 'Relatório Geral - Ambientes Climatizáveis',
        nao_climatizavel: 'Relatório Geral - Ambientes Não Climatizáveis',
        todos: 'Relatório Geral - Todos os Ambientes',
      },
    };

    return TITLES[domain]?.[group] ?? `Relatório Geral - ${group}`;
  }

  public show(): ModalHandle {
    this.debugLog('🎭 Modal show() called - creating modal UI');

    this.modal = createModal({
      title: `${this.resolveTitle()}${this.debugEnabled ? ' [DEBUG MODE]' : ''}`,
      width: '85vw',
      height: '90vh',
      theme: this.params.ui?.theme || 'light',
    });

    this.renderContent();
    this.modal.on('close', () => {
      this.debugLog('🚪 Modal closing - cleaning up resources');

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
            <!-- granularity-toggle hidden: 1h not yet supported, default stays 1d -->
            <div id="granularity-toggle" role="group" aria-label="Granularidade" style="display:none;">
              <button type="button" data-gran="1d">1d</button>
              <button type="button" data-gran="1h">1h</button>
            </div>
            <button id="load-btn" class="myio-btn myio-btn-primary">
              <span class="myio-spinner" id="load-spinner" style="display: none;"></span>
              Carregar
            </button>
            <button id="export-btn" class="myio-btn myio-btn-secondary" disabled>
              Exportar CSV
            </button>
            <button id="export-pdf-btn" class="myio-btn myio-btn-secondary" disabled>
              Exportar PDF
            </button>
            <button id="export-xls-btn" class="myio-btn myio-btn-secondary" disabled>
              Exportar XLS
            </button>
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
    `;

    this.modal.setContent(content);
    this.setupEventListeners();
  }

  private async setupEventListeners(): Promise<void> {
    const loadBtn = document.getElementById('load-btn') as HTMLButtonElement;
    const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
    const filterBtn = document.getElementById('filter-btn') as HTMLButtonElement;
    const dateRangeInput = document.getElementById('date-range') as HTMLInputElement;
    const searchInput = document.getElementById('search-input') as HTMLInputElement;

    loadBtn?.addEventListener('click', () => this.loadData());
    exportBtn?.addEventListener('click', () => this.exportCSV());
    document.getElementById('export-pdf-btn')?.addEventListener('click', () => this.exportPDF());
    document.getElementById('export-xls-btn')?.addEventListener('click', () => this.exportXLS());
    filterBtn?.addEventListener('click', () => this.openFilterModal());

    // Granularity toggle
    const granToggle = document.getElementById('granularity-toggle');
    granToggle?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-gran]') as HTMLElement | null;
      if (!btn) return;
      this.granularity = btn.dataset.gran as '1d' | '1h';
      granToggle.querySelectorAll<HTMLElement>('[data-gran]').forEach((b) => {
        const isActive = b === btn;
        b.style.background = isActive ? 'var(--myio-primary,#1565c0)' : 'transparent';
        b.style.color = isActive ? '#fff' : '#6b7280';
      });
    });

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

    const totalConsumption = this.calculateTotalConsumption();
    const storeCount = Math.max(1, this.data.length);

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; padding: 16px; background: var(--myio-bg); border-radius: 6px;">
        <div style="text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: var(--myio-primary);">${storeCount}</div>
          <div style="color: var(--myio-text-muted);">Dispositivos</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: var(--myio-primary);">${fmtPt(totalConsumption)}</div>
          <div style="color: var(--myio-text-muted);">${this.domainConfig.totalLabel}</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: var(--myio-primary);">${fmtPt(totalConsumption / storeCount)}</div>
          <div style="color: var(--myio-text-muted);">Média por Dispositivo</div>
        </div>
      </div>
    `;

    container.style.display = 'block';
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
      return;
    }

    // RFC-0182: grouped mode when items carry groupLabel
    const isGrouped = paginatedData.some((r) => r.groupLabel);

    const tableRows = isGrouped
      ? this.renderGroupedRows(paginatedData)
      : paginatedData
          .map(
            (row) => `
          <tr>
            <td data-label="Identifier" style="font-family: monospace; font-weight: bold; text-transform: uppercase;">${row.identifier}</td>
            <td data-label="Name"><strong>${row.name}</strong></td>
            <td data-label="${this.domainConfig.label}" style="text-align: right; font-weight: bold;">${fmtPt(row.consumption)}</td>
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
              <th style="cursor: pointer; width: 25%;" data-sort="identifier">
                Identifier
                <span style="margin-left: 4px; opacity: ${this.getSortOpacity('identifier')};">${this.getSortIcon('identifier')}</span>
              </th>
              <th style="cursor: pointer; width: 45%;" data-sort="name">
                Name
                <span style="margin-left: 4px; opacity: ${this.getSortOpacity('name')};">${this.getSortIcon('name')}</span>
              </th>
              <th style="cursor: pointer; text-align: right; width: 30%;" data-sort="consumption">
                ${this.domainConfig.label}
                <span style="margin-left: 4px; opacity: ${this.getSortOpacity('consumption')};">${this.getSortIcon('consumption')}</span>
              </th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    `;

    this.setupTableSorting();
  }

  // RFC-0182: Render rows grouped by groupLabel with section headers (Option B)
  private renderGroupedRows(rows: StoreReading[]): string {
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

    return groupOrder
      .map((groupLabel) => {
        const items = byGroup.get(groupLabel)!;
        const groupTotal = items.reduce((s, r) => s + r.consumption, 0);

        const header = `
        <tr class="rp-group-header">
          <td colspan="3">
            ${groupLabel}
            <span class="rp-group-total">${items.length} dispositivos · ${fmtPt(groupTotal)} ${this.domainConfig.unit}</span>
          </td>
        </tr>`;

        const dataRows = items
          .map(
            (row) => `
        <tr>
          <td data-label="Identifier" style="font-family: monospace; font-weight: bold; text-transform: uppercase;">${row.identifier}</td>
          <td data-label="Name"><strong>${row.name}</strong></td>
          <td data-label="${this.domainConfig.label}" style="text-align: right; font-weight: bold;">${fmtPt(row.consumption)}</td>
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
    return this.data.reduce((sum, row) => sum + row.consumption, 0);
  }

  private openFilterModal(): void {
    if (!this.filterModal) {
      // Initialize filter modal with current data
      this.filterModal = attachFilterOrderingModal({
        title: 'Filtros & Ordenação - Lojas',
        items: this.convertToStoreItems(),
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

  private exportCSV(): void {
    // RFC-0060: Simplified CSV export - only header and data rows
    // Get all data (not just filtered/paginated) for export
    const sortedData = [...this.data].sort((a, b) => b.consumption - a.consumption);

    const csvData = [
      // Header row only
      ['Identificador', 'Nome', `Consumo (${this.domainConfig.unit})`],
      // Data rows
      ...sortedData.map((row) => [row.identifier, row.name, row.consumption.toFixed(2)]),
    ];

    const csvContent = toCsv(csvData);
    this.downloadCSV(csvContent, `relatorio-geral-lojas-${new Date().toISOString().split('T')[0]}.csv`);
  }

  // Maps the report rows to the TelemetryDevice shape consumed by the shared
  // TELEMETRY grid exporters (only labelOrName/name/deviceIdentifier/val/perc are read).
  private buildExportDevices(): TelemetryDevice[] {
    const sorted = [...this.data].sort((a, b) => b.consumption - a.consumption);
    const total = sorted.reduce((s, r) => s + (r.consumption || 0), 0);
    return sorted.map((r) => ({
      labelOrName: r.name,
      name: r.name,
      deviceIdentifier: r.identifier,
      val: r.consumption,
      perc: total > 0 ? (r.consumption / total) * 100 : 0,
    })) as unknown as TelemetryDevice[];
  }

  // PDF export — same premium layout as the TELEMETRY grid export.
  private exportPDF(): void {
    if (!this.data.length) return;
    exportGridPdf(
      this.buildExportDevices(),
      this.resolveTitle(),
      this.domainConfig.unit,
      this.exportPeriod,
      null,
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
    const url = `${baseUrl}/telemetry/customers/${this.params.customerId}/${endpoint}/devices/totals?startTime=${startTime}&endTime=${endTime}&granularity=${this.granularity}`;

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

    return data;
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
      return apiArray.map((item) => ({
        identifier: item.assetName || this.resolveStoreIdentifierFromApi(item) || item.id || '',
        name: item.name || item.assetName || item.id || '',
        consumption: this.pickConsumption(item),
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
