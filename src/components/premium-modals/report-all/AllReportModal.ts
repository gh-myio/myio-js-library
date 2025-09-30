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
  SortMode
} from '../internal/filter-ordering/FilterOrderingModal';
import { OpenAllReportParams, ModalHandle, StoreItem } from '../types';

interface StoreReading {
  identifier: string;  // e.g., "SCMAL1230B" - unique store identifier
  name: string;        // e.g., "McDonalds" - human-readable name
  consumption: number; // e.g., 152.43 - consumption in kWh
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

  constructor(private params: OpenAllReportParams) {
    this.authClient = new AuthClient({
      clientId: params.api.clientId,
      clientSecret: params.api.clientSecret,
      base: params.api.dataApiBaseUrl
    });
  }

  // Helper: normalize identifiers (upper, strip spaces and non-alphanum)
  private normalizeId(v: string | null | undefined): string {
    return (v || '')
      .toString()
      .normalize('NFKC')
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9]/g, '');
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
    const maybe = tokens.find(t => /[A-Za-z0-9]{3,}/.test(t));
    return maybe || null;
  }

  // Helper: pick a numeric consumption from an API item
  private pickNumericConsumption(item: any): number {
    const fields = ['total_value','totalValue','consumption','value','total','energy','kwh'];
    for (const f of fields) {
      if (item?.[f] !== undefined && item?.[f] !== null) {
        const n = typeof item[f] === 'string'
          ? parseFloat(item[f].replace(',', '.'))
          : Number(item[f]);
        if (!Number.isNaN(n)) return n;
      }
    }
    return 0;
  }

  public show(): ModalHandle {
    this.modal = createModal({
      title: 'Relatório Geral - Todas as Lojas',
      width: '85vw',
      height: '90vh',
      theme: this.params.ui?.theme || 'light'
    });

    this.renderContent();
    this.modal.on('close', () => {
      // Cleanup DateRangePicker
      if (this.dateRangePicker) {
        this.dateRangePicker.destroy();
        this.dateRangePicker = null;
      }

      // Cleanup FilterModal
      if (this.filterModal) {
        this.filterModal.destroy();
        this.filterModal = null;
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
            <button id="load-btn" class="myio-btn myio-btn-primary">
              <span class="myio-spinner" id="load-spinner" style="display: none;"></span>
              Carregar
            </button>
            <button id="export-btn" class="myio-btn myio-btn-secondary" disabled>
              Exportar CSV
            </button>
            <button id="filter-btn" class="myio-btn myio-btn-secondary" style="background: var(--myio-brand-700); color: white;">
              🔍 Filtros & Ordenação
            </button>
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
    filterBtn?.addEventListener('click', () => this.openFilterModal());
    searchInput?.addEventListener('input', (e) => {
      this.searchFilter = (e.target as HTMLInputElement).value.toLowerCase();
      this.currentPage = 1;
      this.renderTable();
    });

    // Initialize DateRangePicker with default current month range
    try {
      this.dateRangePicker = await attachDateRangePicker(dateRangeInput, {
        presetStart: this.getDefaultStartDate(),
        presetEnd: this.getDefaultEndDate(),
        maxRangeDays: 31,
        parentEl: this.modal.element,
        onApply: ({ startISO, endISO }) => {
          this.hideError();
          console.log('Date range selected:', { startISO, endISO });
        }
      });
    } catch (error) {
      console.warn('DateRangePicker initialization failed, using fallback:', error);
    }
  }

  private async loadData(): Promise<void> {
    if (this.isLoading) return;

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

      if (!startISO || !endISO) {
        this.showError('Selecione um período válido');
        return;
      }

      const startDate = startISO.split('T')[0];
      const endDate = endISO.split('T')[0];

      // Real Customer Totals API call
      const customerTotalsData = await this.fetchCustomerTotals(startISO, endISO);
      
      // Process and map the API response
      this.data = this.mapCustomerTotalsResponse(customerTotalsData);

      // Initialize all stores as selected by default
      this.selectedStoreIds = new Set(
        this.data.map(store => this.generateStoreId(store.name))
      );

      this.currentPage = 1;
      this.renderSummary();
      this.renderTable();
      this.renderPagination();
      exportBtn.disabled = false;

      this.emit('loaded', {
        date: { start: startDate, end: endDate },
        stores: this.data.length,
        totalConsumption: this.calculateTotalConsumption()
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

  private getFilteredData(): StoreReading[] {
    let filtered = this.data;

    // Apply filter modal selections (if any stores are selected)
    if (this.selectedStoreIds.size > 0) {
      filtered = this.data.filter(store => {
        const storeId = this.generateStoreId(store.name);
        return this.selectedStoreIds.has(storeId);
      });
    }

    // Apply quick search filter
    if (this.searchFilter) {
      filtered = filtered.filter(store =>
        store.name.toLowerCase().includes(this.searchFilter) ||
        store.identifier.toLowerCase().includes(this.searchFilter)
      );
    }

    return filtered.sort((a, b) => {
      const aVal = a[this.sortField];
      const bVal = b[this.sortField];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return this.sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      } else {
        return this.sortDirection === 'asc'
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number);
      }
    });
  }

  private getPaginatedData(): StoreReading[] {
    const filtered = this.getFilteredData();
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return filtered.slice(startIndex, startIndex + this.itemsPerPage);
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
          <div style="color: var(--myio-text-muted);">Lojas</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: var(--myio-primary);">${fmtPt(totalConsumption)}</div>
          <div style="color: var(--myio-text-muted);">Total kWh</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: var(--myio-primary);">${fmtPt(totalConsumption / storeCount)}</div>
          <div style="color: var(--myio-text-muted);">Média por Loja</div>
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

    container.innerHTML = `
      <div style="max-height: 500px; overflow-y: auto; border: 1px solid var(--myio-border); border-radius: 6px;">
        <style>
          @media (max-width: 768px) {
            .myio-table-mobile {
              display: block !important;
            }
            .myio-table-mobile thead,
            .myio-table-mobile tbody,
            .myio-table-mobile th,
            .myio-table-mobile td,
            .myio-table-mobile tr {
              display: block !important;
            }
            .myio-table-mobile thead tr {
              position: absolute !important;
              top: -9999px !important;
              left: -9999px !important;
            }
            .myio-table-mobile tbody tr {
              border: 1px solid var(--myio-border) !important;
              border-radius: 8px !important;
              margin-bottom: 16px !important;
              padding: 16px !important;
              background: white !important;
            }
            .myio-table-mobile tbody td {
              border: none !important;
              padding: 8px 0 !important;
              position: relative !important;
            }
            .myio-table-mobile tbody td:before {
              content: attr(data-label) ": " !important;
              font-weight: bold !important;
              display: inline-block !important;
              width: 120px !important;
              color: var(--myio-text-muted) !important;
            }
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
                Consumption (kWh)
                <span style="margin-left: 4px; opacity: ${this.getSortOpacity('consumption')};">${this.getSortIcon('consumption')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            ${paginatedData.map(row => `
              <tr>
                <td data-label="Identifier" style="font-family: monospace; font-weight: bold; text-transform: uppercase;">${row.identifier}</td>
                <td data-label="Name"><strong>${row.name}</strong></td>
                <td data-label="Consumption (kWh)" style="text-align: right; font-weight: bold;">${row.consumption.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    this.setupTableSorting();
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
    headers.forEach(header => {
      header.addEventListener('click', () => {
        const sortKey = header.getAttribute('data-sort') as keyof StoreReading;

        if (this.sortField === sortKey) {
          this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortField = sortKey;
          this.sortDirection = (sortKey === 'identifier' || sortKey === 'name') ? 'asc' : 'desc';
        }

        this.currentPage = 1;
        this.renderTable();
        this.renderPagination();
      });
    });
  }

  private renderPagination(): void {
    const container = document.getElementById('pagination-container');
    if (!container) return;

    const filteredData = this.getFilteredData();
    const totalPages = Math.ceil(filteredData.length / this.itemsPerPage);

    if (totalPages <= 1) {
      container.style.display = 'none';
      return;
    }

    const startItem = (this.currentPage - 1) * this.itemsPerPage + 1;
    const endItem = Math.min(this.currentPage * this.itemsPerPage, filteredData.length);

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
        <div style="color: var(--myio-text-muted);">
          Mostrando ${startItem}-${endItem} de ${filteredData.length} lojas
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button id="prev-page" class="myio-btn myio-btn-outline" ${this.currentPage === 1 ? 'disabled' : ''}>
            Anterior
          </button>
          <span style="padding: 0 12px; font-weight: bold;">
            ${this.currentPage} / ${totalPages}
          </span>
          <button id="next-page" class="myio-btn myio-btn-outline" ${this.currentPage === totalPages ? 'disabled' : ''}>
            Próximo
          </button>
        </div>
      </div>
    `;

    document.getElementById('prev-page')?.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.renderTable();
        this.renderPagination();
      }
    });

    document.getElementById('next-page')?.addEventListener('click', () => {
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.renderTable();
        this.renderPagination();
      }
    });

    container.style.display = 'block';
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
        }
      });
    } else {
      // Update existing modal with current data
      this.filterModal.setSelection(Array.from(this.selectedStoreIds));
      this.filterModal.setSort(this.currentSortMode);
    }

    this.filterModal.open();
  }

  private convertToStoreItems(): StoreItem[] {
    return this.data.map(store => ({
      id: this.generateStoreId(store.name), // or this.generateStoreId(store.identifier) if you prefer
      identifier: store.identifier,         // <-- required by StoreItem
      label: store.name,
      consumption: store.consumption
    }));
  }

  private generateStoreId(storeName: string): string {
    // Generate consistent ID from store name
    return storeName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
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
    this.renderPagination();

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
    const totalConsumption = this.calculateTotalConsumption();
    const now = new Date();
    const timestamp = now.toLocaleDateString('pt-BR') + ' - ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // Get all data (not just filtered/paginated) for export
    const sortedData = [...this.data].sort((a, b) => b.consumption - a.consumption);

    const csvData = [
      ['RELATÓRIO GERAL - TODAS AS LOJAS', '', '', ''],
      ['DATA EMISSÃO', timestamp, '', ''],
      ['RESUMO', '', '', ''],
      ['Total de Lojas', this.data.length.toString(), '', ''],
      ['Consumo Total', totalConsumption.toFixed(2), 'kWh', ''],
      ['Consumo Médio por Loja', (totalConsumption / this.data.length).toFixed(2), 'kWh', ''],
      ['', '', '', ''],
      ['DETALHAMENTO POR LOJA', '', '', ''],
      ['Identifier', 'Name', 'Consumption (kWh)', ''],
      ...sortedData.map(row => [row.identifier, row.name, row.consumption.toFixed(2), ''])
    ];

    const csvContent = toCsv(csvData);
    this.downloadCSV(csvContent, `relatorio-geral-lojas-${new Date().toISOString().split('T')[0]}.csv`);
  }

  private async fetchCustomerTotals(startISO: string, endISO: string): Promise<any> {
    // Check if custom fetcher is provided (for testing/demo)
    if (this.params.fetcher) {
      // Use ingestionToken for Data API endpoints (data.apps.myio-bas.com)
      const token = this.params.api.ingestionToken || await this.authClient.getBearer();
      return await this.params.fetcher({
        baseUrl: this.params.api.dataApiBaseUrl || 'https://api.data.apps.myio-bas.com',
        token: token,
        customerId: this.params.customerId,
        startISO,
        endISO
      });
    }

    // Real Customer Totals API implementation
    // Use ingestionToken for Data API endpoints (data.apps.myio-bas.com)
    const token = this.params.api.ingestionToken;
    if (!token) {
      throw new Error('ingestionToken is required for Data API calls to data.apps.myio-bas.com');
    }
    
    const baseUrl = this.params.api.dataApiBaseUrl || 'https://api.data.apps.myio-bas.com';
    
    // Format timestamps for API call
    const startTime = encodeURIComponent(startISO);
    const endTime = encodeURIComponent(endISO);
    
    const url = `${baseUrl}/api/v1/telemetry/customers/${this.params.customerId}/energy/devices/totals?startTime=${startTime}&endTime=${endTime}`;
    
    console.log('[AllReportModal] Fetching customer totals:', { url, customerId: this.params.customerId });
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        // Using ingestionToken for Data API endpoints (data.apps.myio-bas.com)
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[AllReportModal] Customer totals response:', data);
    
    return data;
  }

  private mapCustomerTotalsResponse(apiResponse: any): StoreReading[] {
    // 1) Normalize raw array
    let dataArray: any[] = [];
    if (apiResponse && Array.isArray(apiResponse.data)) {
      dataArray = apiResponse.data;
    } else if (Array.isArray(apiResponse)) {
      dataArray = apiResponse;
    } else {
      console.warn('[AllReportModal] Invalid API response structure:', apiResponse);
      return [];
    }

    // 2) Aggregate devices by STORE identifier
    // key = normalized store identifier (e.g., "SCMAL2AC205HIJ")
    const storeAgg = new Map<string, number>();

    for (const item of dataArray) {
      const rawStoreId = this.resolveStoreIdentifierFromApi(item);
      if (!rawStoreId) continue;
      const key = this.normalizeId(rawStoreId);
      const val = this.pickNumericConsumption(item);
      storeAgg.set(key, (storeAgg.get(key) || 0) + val);
    }

    // 3) Map to UI rows using itemsList identifiers
    const rows: StoreReading[] = this.params.itemsList.map((storeItem) => {
      // itemsList provides the store code in `identifier` and the display label in `label`
      const normalizedIdentifier = this.normalizeId(storeItem.identifier);
      const consumption = storeAgg.get(normalizedIdentifier) || 0;
      return {
        identifier: storeItem.identifier, // keep original formatting in UI
        name: storeItem.label,
        consumption: Math.round(consumption * 100) / 100
      };
    });

    console.log(
      '[AllReportModal] Aggregated:',
      { storesInApi: storeAgg.size, storesInList: this.params.itemsList.length }
    );

    return rows;
  }

  private parseConsumptionValue(item: any): number {
    // Try various possible field names for consumption value
    const possibleFields = [
      'total_value',
      'totalValue', 
      'consumption',
      'value',
      'total',
      'energy',
      'kwh'
    ];

    for (const field of possibleFields) {
      if (item[field] !== undefined && item[field] !== null) {
        const value = typeof item[field] === 'string' 
          ? parseFloat(item[field].replace(',', '.')) 
          : Number(item[field]);
        
        if (!isNaN(value)) {
          return Math.round(value * 100) / 100; // Round to 2 decimal places
        }
      }
    }

    console.warn('[AllReportModal] No valid consumption value found in item:', item);
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
      this.eventHandlers[event].forEach(handler => handler());
    }
  }
}
