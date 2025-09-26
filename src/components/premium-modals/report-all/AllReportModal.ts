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
  StoreItem,
  SortMode
} from '../internal/filter-ordering/FilterOrderingModal';
import { OpenAllReportParams, ModalHandle } from '../types';

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
            <button id="filter-btn" class="myio-btn myio-btn-secondary" style="background: #7C3AED; color: white;">
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

      // Mock API call - replace with real implementation
      const mockData = this.generateMockData();

      this.data = mockData;

      // Initialize all stores as selected by default
      this.selectedStoreIds = new Set(
        mockData.map(store => this.generateStoreId(store.name))
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

  private generateMockData(): StoreReading[] {
    // Generate realistic mock data for multiple stores
    const storeData = [
      { name: 'McDonalds', identifier: 'SCMAL1230B' },
      { name: 'Burger King', identifier: 'BKMAL0945A' },
      { name: 'Subway', identifier: 'SUBRI2156C' },
      { name: 'Pizza Hut', identifier: 'PHMAL3789D' },
      { name: 'KFC', identifier: 'KFCSP1642E' },
      { name: 'Outback', identifier: 'OBMAL5823F' },
      { name: 'Habib\'s', identifier: 'HBSP2947G' },
      { name: 'Giraffas', identifier: 'GRMAL4156H' },
      { name: 'Spoleto', identifier: 'SPMAL8372I' },
      { name: 'Bob\'s', identifier: 'BOBSP6419J' },
      { name: 'Domino\'s', identifier: 'DMMAL9573K' },
      { name: 'China in Box', identifier: 'CIBSP3864L' },
      { name: 'Açaí Concept', identifier: 'ACMAL7251M' },
      { name: 'Starbucks', identifier: 'SBMAL1598N' },
      { name: 'Dunkin\'', identifier: 'DKSP4729O' },
      { name: 'Kopenhagen', identifier: 'KPMAL8163P' },
      { name: 'Cacau Show', identifier: 'CSMAL5947Q' },
      { name: 'Boticário', identifier: 'BTMAL2831R' },
      { name: 'Natura', identifier: 'NTSP6472S' }
    ];

    return storeData
      .filter(store => !this.shouldExcludeStore(store.name))
      .map(store => ({
        identifier: store.identifier,
        name: store.name,
        consumption: Math.round((Math.random() * 2000 + 500) * 100) / 100 // 500-2500 kWh with 2 decimal places
      }));
  }

  private shouldExcludeStore(storeName: string): boolean {
    if (!this.params.filters?.excludeLabels) return false;

    return this.params.filters.excludeLabels.some(filter => {
      if (filter instanceof RegExp) {
        return filter.test(storeName);
      }
      return storeName.toLowerCase().includes(filter.toLowerCase());
    });
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
    const storeCount = this.data.length;

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
                <span style="margin-left: 4px; opacity: 0.5;">${this.getSortIcon('identifier')}</span>
              </th>
              <th style="cursor: pointer; width: 45%;" data-sort="name">
                Name
                <span style="margin-left: 4px; opacity: 0.5;">${this.getSortIcon('name')}</span>
              </th>
              <th style="cursor: pointer; text-align: right; width: 30%;" data-sort="consumption">
                Consumption (kWh)
                <span style="margin-left: 4px; opacity: 0.5;">${this.getSortIcon('consumption')}</span>
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
      id: this.generateStoreId(store.name),
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
      filterBtn.style.background = '#5B21B6'; // Darker purple for active state
    } else {
      filterBtn.innerHTML = '🔍 Filtros & Ordenação';
      filterBtn.style.background = '#7C3AED';
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

  private downloadCSV(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
